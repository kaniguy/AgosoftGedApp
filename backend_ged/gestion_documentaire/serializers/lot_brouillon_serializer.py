import json

from django.db import transaction
from rest_framework import serializers

from config.file_validation import drf_validate_document
from gestion_documentaire.models import ItemLotBrouillonRattachement, LotBrouillonRattachement
from gestion_documentaire.services.localite_chemin import nodes_map_for_localite_ids, build_chemin_from_map
from gestion_documentaire.services.lot_brouillon_storage import delete_lot_brouillon_item_file
from parametrage.models.plan_geographique import PlanGeographique


class ItemLotBrouillonSerializer(serializers.ModelSerializer):
    fichier_url = serializers.SerializerMethodField()

    class Meta:
        model = ItemLotBrouillonRattachement
        fields = [
            "id",
            "identifiant_client",
            "ordre",
            "nom_fichier",
            "fichier_url",
            "field_values",
            "zone_overrides",
            "date_modification",
        ]

    def get_fichier_url(self, obj):
        """Aperçu brouillon : endpoint auth (fichier chiffré hors /media/)."""
        if not obj.fichier or not obj.pk:
            return None
        request = self.context.get("request")
        from urllib.parse import quote

        filename = obj.nom_fichier or f"brouillon-{obj.pk}.pdf"
        path = (
            f"/api/gestion-documentaire/lots-brouillon/items/{obj.pk}/fichier/"
            f"?name={quote(filename)}"
        )
        if request:
            return request.build_absolute_uri(path)
        return path


class LotBrouillonListSerializer(serializers.ModelSerializer):
    localite_libelle = serializers.CharField(source="localite.libelle", read_only=True)
    localite_chemin_str = serializers.SerializerMethodField()
    type_document_libelle = serializers.CharField(source="type_document.libelle", read_only=True)
    utilisateur_nom = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

    class Meta:
        model = LotBrouillonRattachement
        fields = [
            "id",
            "localite",
            "localite_libelle",
            "localite_chemin_str",
            "type_document",
            "type_document_libelle",
            "utilisateur",
            "utilisateur_nom",
            "index_actif",
            "total_count",
            "pending_count",
            "date_creation",
            "date_modification",
        ]

    def get_utilisateur_nom(self, obj):
        user = getattr(obj, "utilisateur", None)
        if not user:
            return ""
        full_name = user.get_full_name().strip()
        return full_name or user.get_username()

    def get_localite_chemin_str(self, obj):
        chemin_map = self.context.get("localite_chemin_map")
        if chemin_map is not None:
            chemin = build_chemin_from_map(obj.localite_id, chemin_map)
            return " > ".join(n["libelle"] for n in chemin)
        return obj.localite.libelle or ""

    def get_total_count(self, obj):
        return obj.items.count()

    def get_pending_count(self, obj):
        return obj.items.count()


class LotBrouillonDetailSerializer(LotBrouillonListSerializer):
    items = ItemLotBrouillonSerializer(many=True, read_only=True)

    class Meta(LotBrouillonListSerializer.Meta):
        fields = LotBrouillonListSerializer.Meta.fields + ["items"]


class LotBrouillonSyncSerializer(serializers.Serializer):
    lot_id = serializers.IntegerField(required=False, allow_null=True)
    localite_id = serializers.IntegerField()
    type_document_id = serializers.IntegerField()
    batch_active_index = serializers.IntegerField(min_value=0, default=0)
    items = serializers.CharField()

    def validate_localite_id(self, value):
        try:
            localite = PlanGeographique.objects.select_related("niveau").get(pk=value)
        except PlanGeographique.DoesNotExist as exc:
            raise serializers.ValidationError("Localité introuvable.") from exc
        if localite.get_niveau_enfant() is not None:
            raise serializers.ValidationError(
                "Seul le dernier niveau géographique peut recevoir des documents."
            )
        self.context["localite"] = localite
        return value

    def validate_items(self, raw):
        try:
            parsed = json.loads(raw or "[]")
        except json.JSONDecodeError as exc:
            raise serializers.ValidationError("JSON items invalide.") from exc
        if not isinstance(parsed, list):
            raise serializers.ValidationError("items doit être une liste.")
        if not parsed:
            raise serializers.ValidationError("Au moins un document est requis.")
        for index, item in enumerate(parsed):
            if not isinstance(item, dict):
                raise serializers.ValidationError(f"Item {index + 1} invalide.")
            if not item.get("client_id"):
                raise serializers.ValidationError(f"Item {index + 1} : client_id manquant.")
        return parsed

    def _user_can_access_localite(self, user, localite):
        from gestion_acces.services.access_service import get_user_leaf_localite_ids

        if user.is_superuser:
            return True
        leaf_ids = get_user_leaf_localite_ids(user)
        if leaf_ids is None:
            return True
        return localite.id in leaf_ids

    @transaction.atomic
    def save(self, **kwargs):
        request = self.context["request"]
        user = request.user
        localite = self.context["localite"]
        if not self._user_can_access_localite(user, localite):
            raise serializers.ValidationError({"localite_id": "Accès refusé à cette localité."})

        items_data = self.validated_data["items"]
        lot_id = self.validated_data.get("lot_id")
        type_document_id = self.validated_data["type_document_id"]
        batch_active_index = self.validated_data["batch_active_index"]

        lot = None
        if lot_id:
            lot = LotBrouillonRattachement.objects.filter(pk=lot_id).first()
            if lot:
                if lot.localite_id != localite.id:
                    raise serializers.ValidationError(
                        {"lot_id": "Ce brouillon ne correspond pas à la localité indiquée."}
                    )
                if not self._user_can_access_localite(user, lot.localite):
                    raise serializers.ValidationError({"lot_id": "Accès refusé à ce brouillon."})
        if not lot:
            lot, _ = LotBrouillonRattachement.objects.get_or_create(
                localite=localite,
                defaults={
                    "utilisateur": user,
                    "type_document_id": type_document_id,
                    "index_actif": batch_active_index,
                },
            )

        lot.utilisateur = user
        lot.type_document_id = type_document_id
        lot.index_actif = min(batch_active_index, max(0, len(items_data) - 1))
        lot.save(update_fields=["utilisateur", "type_document_id", "index_actif"])  # ALLOWED

        incoming_client_ids = set()
        for ordre, item_data in enumerate(items_data):
            client_id = str(item_data["client_id"])[:64]
            incoming_client_ids.add(client_id)
            upload_key = f"file_{client_id}"
            upload_file = request.FILES.get(upload_key)
            upload_flag = item_data.get("upload_file", False)

            item, created = ItemLotBrouillonRattachement.objects.get_or_create(
                lot=lot,
                identifiant_client=client_id,
                defaults={
                    "ordre": ordre,
                    "nom_fichier": item_data.get("name") or "document.pdf",
                    "field_values": item_data.get("field_values") or {},
                    "zone_overrides": item_data.get("zone_overrides") or {},
                },
            )

            item.ordre = ordre
            item.nom_fichier = item_data.get("name") or item.nom_fichier or "document.pdf"
            item.field_values = item_data.get("field_values") or {}
            item.zone_overrides = item_data.get("zone_overrides") or {}

            if upload_file:
                try:
                    drf_validate_document(upload_file)
                except serializers.ValidationError as exc:
                    detail = exc.detail
                    if isinstance(detail, list):
                        detail = detail[0]
                    raise serializers.ValidationError({upload_key: detail}) from exc
                if item.fichier:
                    delete_lot_brouillon_item_file(item)
                item.fichier = upload_file
            elif created and not item.fichier:
                raise serializers.ValidationError(
                    {upload_key: f"Fichier manquant pour {client_id}."}
                )
            elif not item.fichier and upload_flag:
                raise serializers.ValidationError(
                    {upload_key: f"Fichier requis pour {client_id}."}
                )

            item.save()  # ALLOWED — mime/content_type validated when upload_file present

        stale = lot.items.exclude(identifiant_client__in=incoming_client_ids)
        for old_item in stale:
            old_item.delete()

        if not lot.items.exists():
            lot.delete()
            return None

        return lot

    def to_representation(self, instance):
        if instance is None:
            return {"deleted": True}
        chemin_map = nodes_map_for_localite_ids([instance.localite_id])
        return LotBrouillonDetailSerializer(
            instance, context={**self.context, "localite_chemin_map": chemin_map}
        ).data
