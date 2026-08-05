import json

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from config.file_validation import drf_validate_document
from gestion_documentaire.models import DocumentLocalite, DocumentVersion
from gestion_documentaire.services.document_storage import (
    assign_document_fichier,
    promote_document_to_archive,
    QC_ROOT,
    _normalize_path,
    _path_starts_with_root,
)
from gestion_documentaire.services.document_version_service import archive_document_version
from parametrage.models.champs_document import ChampsDocument, ReponseDocument, TypeDocument, ValeurChamp
from parametrage.models.plan_geographique import PlanGeographique


def _user_brief(user):
    if not user:
        return None
    nom = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.get_username()
    return {
        "id": user.id,
        "nom": nom,
        "email": user.email or "",
    }


class ValeurChampInputSerializer(serializers.Serializer):
    champ_id = serializers.IntegerField()
    valeur = serializers.CharField(allow_blank=True, required=False, default="")


class DocumentLocaliteSerializer(serializers.ModelSerializer):
    type_document_libelle = serializers.CharField(source="type_document.libelle", read_only=True)
    localite_libelle = serializers.CharField(source="localite.libelle", read_only=True)
    localite_chemin = serializers.SerializerMethodField()
    fichier_url = serializers.SerializerMethodField()
    valeurs = serializers.SerializerMethodField()
    importe_par = serializers.SerializerMethodField()
    valide_par_info = serializers.SerializerMethodField()
    rejete_par_info = serializers.SerializerMethodField()
    version_courante = serializers.IntegerField(read_only=True)
    annotations = serializers.JSONField(required=False)

    class Meta:
        model = DocumentLocalite
        fields = [
            "id",
            "localite",
            "localite_libelle",
            "localite_chemin",
            "type_document",
            "type_document_libelle",
            "fichier",
            "fichier_url",
            "date_creation",
            "valeurs",
            "statut_qualite",
            "importe_par",
            "valide_par_info",
            "valide_le",
            "rejete_par_info",
            "rejete_le",
            "motif_rejet",
            "version_courante",
            "annotations",
        ]
        read_only_fields = (
            "fichier",
            "date_creation",
            "statut_qualite",
            "valide_le",
            "rejete_le",
            "motif_rejet",
        )

    def get_importe_par(self, obj):
        return _user_brief(obj.created_by)

    def get_valide_par_info(self, obj):
        return _user_brief(obj.valide_par)

    def get_rejete_par_info(self, obj):
        return _user_brief(obj.rejete_par)

    def get_localite_chemin(self, obj):
        nodes_map = self.context.get("localite_nodes_map")
        if nodes_map is not None:
            from gestion_documentaire.services.localite_chemin import build_chemin_from_map

            return build_chemin_from_map(obj.localite_id, nodes_map)
        if not obj.localite_id:
            return []
        from gestion_documentaire.services.localite_chemin import nodes_map_for_localite_ids

        chemin_map = nodes_map_for_localite_ids([obj.localite_id])
        from gestion_documentaire.services.localite_chemin import build_chemin_from_map

        return build_chemin_from_map(obj.localite_id, chemin_map)

    def get_fichier_url(self, obj):
        """URL d'aperçu authentifiée (déchiffrement côté API), pas le /media/ brut."""
        if not obj.fichier or not obj.pk:
            return None
        request = self.context.get("request")
        from gestion_documentaire.services.document_storage import download_display_filename
        import os
        from urllib.parse import quote

        raw = os.path.basename(obj.fichier.name) or f"document-{obj.pk}.pdf"
        filename = download_display_filename(raw, fallback=f"document-{obj.pk}.pdf")
        path = f"/api/gestion-documentaire/documents/{obj.pk}/fichier/?name={quote(filename)}"
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_valeurs(self, obj):
        if not obj.reponse_id:
            return []
        return [
            {
                "champ_id": v.champ_id,
                "libelle_champ": v.champ.libelle_champ,
                "valeur": v.valeur,
            }
            for v in obj.reponse.valeurs.select_related("champ").all()
        ]


class DocumentLocaliteCreateSerializer(serializers.Serializer):
    localite = serializers.PrimaryKeyRelatedField(queryset=PlanGeographique.objects.all())
    type_document = serializers.PrimaryKeyRelatedField(queryset=TypeDocument.objects.all())
    fichier = serializers.FileField()
    valeurs = serializers.CharField(required=False, allow_blank=True, default="[]")

    def validate_fichier(self, fichier):
        return drf_validate_document(fichier)

    def validate(self, attrs):
        localite = attrs["localite"]
        if localite.get_niveau_enfant() is not None:
            raise serializers.ValidationError(
                {"localite": "Les documents ne peuvent être rattachés qu'au dernier niveau."}
            )
        return attrs

    def _parse_valeurs(self, raw):
        return _parse_valeurs_list(raw)

    @transaction.atomic
    def create(self, validated_data):
        localite = validated_data["localite"]
        type_document = validated_data["type_document"]
        fichier = validated_data["fichier"]
        valeurs_data = self._parse_valeurs(validated_data.get("valeurs", "[]"))
        request = self.context.get("request")

        champs = _validate_valeurs_for_type(type_document, valeurs_data)

        reponse = ReponseDocument.objects.create(type_document=type_document)
        document = DocumentLocalite.objects.create(
            localite=localite,
            type_document=type_document,
            fichier=fichier,
            reponse=reponse,
            created_by=request.user if request and request.user.is_authenticated else None,
            statut_qualite=DocumentLocalite.STATUT_BROUILLON,
            motif_rejet="",
        )

        for item in valeurs_data:
            champ_id = item["champ_id"]
            if champ_id not in champs:
                continue
            ValeurChamp.objects.create(
                reponse=reponse,
                champ_id=champ_id,
                valeur=str(item.get("valeur", "")),
            )

        return document

    def to_representation(self, instance):
        return DocumentLocaliteSerializer(instance, context=self.context).data


def _parse_valeurs_list(raw):
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise serializers.ValidationError({"valeurs": "JSON invalide."}) from exc
    if not isinstance(parsed, list):
        raise serializers.ValidationError({"valeurs": "Doit être une liste."})
    serializer = ValeurChampInputSerializer(data=parsed, many=True)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _validate_valeurs_for_type(type_document, valeurs_data):
    champs = {
        c.id: c
        for c in ChampsDocument.objects.filter(type_document=type_document).prefetch_related("options")
    }
    for item in valeurs_data:
        champ = champs.get(item["champ_id"])
        if not champ:
            raise serializers.ValidationError(
                {"valeurs": f"Champ {item['champ_id']} inconnu pour ce type."}
            )
        if champ.obligatoire and not str(item.get("valeur", "")).strip():
            raise serializers.ValidationError(
                {"valeurs": f"Le champ « {champ.libelle_champ} » est obligatoire."}
            )
    return champs


class DocumentLocaliteUpdateSerializer(serializers.Serializer):
    SAVE_OVERWRITE = "overwrite"
    SAVE_NEW_VERSION = "new_version"
    SAVE_MODE_CHOICES = (
        (SAVE_OVERWRITE, "Écraser la version courante"),
        (SAVE_NEW_VERSION, "Créer une nouvelle version"),
    )

    type_document = serializers.PrimaryKeyRelatedField(
        queryset=TypeDocument.objects.all(), required=False
    )
    fichier = serializers.FileField(required=False, allow_null=True)
    valeurs = serializers.CharField(required=False, allow_blank=True)
    annotations = serializers.CharField(required=False, allow_blank=True)
    save_mode = serializers.ChoiceField(
        choices=SAVE_MODE_CHOICES, required=False, default=SAVE_OVERWRITE
    )

    def validate_fichier(self, fichier):
        if not fichier:
            return fichier
        return drf_validate_document(fichier)

    def _parse_annotations(self, raw):
        if raw is None:
            return None
        if isinstance(raw, list):
            return raw
        if not str(raw).strip():
            return []
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise serializers.ValidationError({"annotations": "JSON invalide."}) from exc
        if not isinstance(parsed, list):
            raise serializers.ValidationError({"annotations": "Doit être une liste."})
        return parsed

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        type_document = validated_data.get("type_document", instance.type_document)
        fichier = validated_data.get("fichier")
        raw_valeurs = validated_data.get("valeurs")
        raw_annotations = validated_data.get("annotations")
        save_mode = validated_data.get("save_mode", self.SAVE_OVERWRITE)

        if raw_valeurs is not None:
            valeurs_data = _parse_valeurs_list(raw_valeurs)
            champs = _validate_valeurs_for_type(type_document, valeurs_data)
        else:
            valeurs_data = None
            champs = None

        annotations_data = self._parse_annotations(raw_annotations) if raw_annotations is not None else None

        annotations_avant = list(instance.annotations or []) if annotations_data is not None else None

        type_changed = type_document != instance.type_document
        has_content_change = bool(
            fichier
            or type_changed
            or valeurs_data is not None
            or annotations_data is not None
        )

        if has_content_change:
            if save_mode == self.SAVE_NEW_VERSION:
                archive_document_version(
                    instance,
                    user,
                    increment_version=True,
                )
            instance.date_creation = timezone.now()

        pending_update_fields = []
        if has_content_change:
            pending_update_fields.append("date_creation")

        if type_changed:
            instance.type_document = type_document
            instance.reponse.type_document = type_document
            instance.reponse.save(update_fields=["type_document"])

        if fichier:
            assign_document_fichier(instance, fichier)
        elif type_changed:
            instance.save(update_fields=["type_document", *pending_update_fields])
            pending_update_fields = []

        if annotations_data is not None:
            instance.annotations = annotations_data
            pending_update_fields.append("annotations")

        if valeurs_data is not None and champs is not None:
            instance.reponse.valeurs.all().delete()
            for item in valeurs_data:
                champ_id = item["champ_id"]
                if champ_id not in champs:
                    continue
                ValeurChamp.objects.create(
                    reponse=instance.reponse,
                    champ_id=champ_id,
                    valeur=str(item.get("valeur", "")),
                )

        if pending_update_fields:
            instance.save(update_fields=list(dict.fromkeys(pending_update_fields)))

        if has_content_change:
            from gestion_acces.services.audit_service import log_modifications_document

            log_modifications_document(
                request=request,
                document=instance,
                annotations_avant=annotations_avant,
                annotations_apres=annotations_data,
                fichier_modifie=bool(fichier),
                valeurs_modifiees=valeurs_data is not None,
                type_modifie=type_changed,
            )

        return instance

    def to_representation(self, instance):
        return DocumentLocaliteSerializer(instance, context=self.context).data


class DocumentVersionSerializer(serializers.ModelSerializer):
    fichier_url = serializers.SerializerMethodField()
    created_by_nom = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "version_number",
            "fichier_url",
            "valeurs_snapshot",
            "annotations",
            "created_by_nom",
            "date_creation",
            "commentaire",
        ]

    def get_fichier_url(self, obj):
        if not obj.fichier or not obj.document_id or not obj.pk:
            return None
        request = self.context.get("request")
        from gestion_documentaire.services.document_storage import download_display_filename
        import os
        from urllib.parse import quote

        raw = os.path.basename(obj.fichier.name) or f"document-{obj.document_id}-v{obj.version_number}.pdf"
        filename = download_display_filename(
            raw, fallback=f"document-{obj.document_id}-v{obj.version_number}.pdf"
        )
        path = (
            f"/api/gestion-documentaire/documents/{obj.document_id}/fichier/"
            f"?version_id={obj.pk}&name={quote(filename)}"
        )
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_created_by_nom(self, obj):
        brief = _user_brief(obj.created_by)
        return brief.get("nom", "") if brief else ""


class DocumentControleQualiteSoumettreSerializer(serializers.Serializer):
    """Soumission brouillon / rejeté → en attente de validation."""

    fichier = serializers.FileField(required=False, allow_null=True)
    valeurs = serializers.CharField(required=False, allow_blank=True)

    def validate_fichier(self, fichier):
        if not fichier:
            return fichier
        return drf_validate_document(fichier)

    def validate(self, attrs):
        allowed = (DocumentLocalite.STATUT_BROUILLON, DocumentLocalite.STATUT_REJETE)
        if self.instance.statut_qualite not in allowed:
            raise serializers.ValidationError(
                "Seuls les brouillons ou documents rejetés peuvent être soumis à validation."
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        type_document = instance.type_document
        fichier = validated_data.get("fichier")
        raw_valeurs = validated_data.get("valeurs")

        if raw_valeurs is not None:
            valeurs_data = _parse_valeurs_list(raw_valeurs)
            champs = _validate_valeurs_for_type(type_document, valeurs_data)
        else:
            valeurs_data = None
            champs = None

        if fichier:
            assign_document_fichier(instance, fichier)

        instance.statut_qualite = DocumentLocalite.STATUT_EN_ATTENTE
        instance.rejete_par = None
        instance.rejete_le = None
        instance.motif_rejet = ""
        instance.valide_par = None
        instance.valide_le = None
        instance.save()

        if valeurs_data is not None and champs is not None:
            instance.reponse.valeurs.all().delete()
            for item in valeurs_data:
                champ_id = item["champ_id"]
                if champ_id not in champs:
                    continue
                ValeurChamp.objects.create(
                    reponse=instance.reponse,
                    champ_id=champ_id,
                    valeur=str(item.get("valeur", "")),
                )

        return instance

    def to_representation(self, instance):
        return DocumentLocaliteSerializer(instance, context=self.context).data


class DocumentControleQualiteValiderSerializer(serializers.Serializer):
    fichier = serializers.FileField(required=False, allow_null=True)
    valeurs = serializers.CharField(required=False, allow_blank=True)

    def validate_fichier(self, fichier):
        if not fichier:
            return fichier
        return drf_validate_document(fichier)

    def validate(self, attrs):
        if self.instance.statut_qualite != DocumentLocalite.STATUT_EN_ATTENTE:
            raise serializers.ValidationError(
                "Seuls les documents en attente de validation peuvent être validés."
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        from django.utils import timezone

        request = self.context.get("request")
        type_document = instance.type_document
        fichier = validated_data.get("fichier")
        raw_valeurs = validated_data.get("valeurs")

        if raw_valeurs is not None:
            valeurs_data = _parse_valeurs_list(raw_valeurs)
            champs = _validate_valeurs_for_type(type_document, valeurs_data)
        else:
            valeurs_data = None
            champs = None

        instance.statut_qualite = DocumentLocalite.STATUT_VALIDE
        instance.valide_par = request.user if request and request.user.is_authenticated else None
        instance.valide_le = timezone.now()
        instance.rejete_par = None
        instance.rejete_le = None
        instance.motif_rejet = ""
        instance.save()

        if fichier:
            assign_document_fichier(instance, fichier)
        else:
            if not promote_document_to_archive(instance):
                old_name = (
                    _normalize_path(instance.fichier.name)
                    if instance.fichier and instance.fichier.name
                    else ""
                )
                if old_name and _path_starts_with_root(old_name, QC_ROOT):
                    raise serializers.ValidationError(
                        {
                            "detail": (
                                "Le document a été validé en base mais le fichier "
                                "n'a pas pu être déplacé vers l'archive."
                            )
                        }
                    )
            instance.refresh_from_db()

        if valeurs_data is not None and champs is not None:
            instance.reponse.valeurs.all().delete()
            for item in valeurs_data:
                champ_id = item["champ_id"]
                if champ_id not in champs:
                    continue
                ValeurChamp.objects.create(
                    reponse=instance.reponse,
                    champ_id=champ_id,
                    valeur=str(item.get("valeur", "")),
                )

        return instance

    def to_representation(self, instance):
        return DocumentLocaliteSerializer(instance, context=self.context).data


class DocumentControleQualiteRejeterSerializer(serializers.Serializer):
    motif_rejet = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if self.instance.statut_qualite != DocumentLocalite.STATUT_EN_ATTENTE:
            raise serializers.ValidationError(
                "Seuls les documents en attente de validation peuvent être rejetés."
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        from django.utils import timezone

        request = self.context.get("request")
        instance.statut_qualite = DocumentLocalite.STATUT_REJETE
        instance.rejete_par = request.user if request and request.user.is_authenticated else None
        instance.rejete_le = timezone.now()
        instance.motif_rejet = validated_data.get("motif_rejet", "")
        instance.save()
        return instance

    def to_representation(self, instance):
        return DocumentLocaliteSerializer(instance, context=self.context).data
