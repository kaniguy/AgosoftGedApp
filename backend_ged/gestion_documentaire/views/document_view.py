# API REST : consultation, filtres toolbar + filtres par colonne (document_column_filters), rattachement et OCR
from collections import defaultdict
from datetime import datetime
import os

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from config.file_validation import validate_document_upload
from django.core.exceptions import ValidationError as DjangoValidationError
from gestion_acces.permissions import (
    CanSoumettreDocumentQualite,
    GedDjangoModelPermissions,
    RequiresDjangoPerm,
)
from gestion_acces.services.access_service import filter_document_queryset
from rest_framework.response import Response

from parametrage.models.champs_document import ChampsDocument, TypeDocument

from gestion_documentaire.models import DocumentLocalite
from gestion_documentaire.models.document_comment import DocumentComment
from gestion_documentaire.serializers.document_serializer import (
    DocumentControleQualiteRejeterSerializer,
    DocumentControleQualiteSoumettreSerializer,
    DocumentControleQualiteValiderSerializer,
    DocumentLocaliteCreateSerializer,
    DocumentLocaliteSerializer,
    DocumentLocaliteUpdateSerializer,
    DocumentVersionSerializer,
)
from gestion_documentaire.serializers.document_comment_serializer import DocumentCommentSerializer
from gestion_documentaire.services.field_extractor import extract_field_values
from gestion_documentaire.services.archive_service import build_documents_archive
from gestion_documentaire.services.document_download_service import (
    get_archived_version_download_payload,
    get_document_download_payload,
)
from gestion_documentaire.services.document_version_service import dedupe_archived_versions
from gestion_documentaire.services.controle_qualite_access import user_can_filter_documents_by_statut
from gestion_documentaire.services.ocr_service import extract_text_from_file
from gestion_documentaire.services.qr_decoder import extract_qr_field_values
from gestion_documentaire.services.barcode_decoder import extract_barcode_field_values
from gestion_documentaire.services.zone_extractor import extract_field_values_by_zones
from gestion_documentaire.services.zone_override import apply_zone_overrides, parse_ocr_pages, parse_zone_overrides

PAGE_SIZE = 15


from gestion_documentaire.services.document_list_queryset import (
    apply_champ_index_filters as _apply_champ_index_filters,
    build_document_list_queryset,
    parse_date_param as _parse_date_param,
)
from gestion_documentaire.services.document_column_filters import FORMAT_EXTENSIONS


class DocumentLocaliteViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """API de rattachement et consultation des documents sur une localité."""

    permission_classes = [IsAuthenticated, GedDjangoModelPermissions]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    QC_ACTION_PERMISSIONS = {
        "soumettre_controle_qualite": "gestion_documentaire.qc_soumettre",
        "valider_controle_qualite": "gestion_documentaire.qc_valider",
        "rejeter_controle_qualite": "gestion_documentaire.qc_rejeter",
    }

    def get_permissions(self):
        action = getattr(self, "action", None)
        if action == "soumettre_controle_qualite":
            return [IsAuthenticated(), CanSoumettreDocumentQualite()]
        qc_perm = self.QC_ACTION_PERMISSIONS.get(action)
        if qc_perm:
            self.required_permission = qc_perm
            return [IsAuthenticated(), RequiresDjangoPerm()]

        if action in ("telecharger", "telecharger_archive"):
            self.required_permission = "gestion_documentaire.telecharger_document"
            return [IsAuthenticated(), RequiresDjangoPerm()]

        method = getattr(self.request, "method", "GET").upper()
        if action == "commentaires" and method == "POST":
            self.required_permission = "gestion_documentaire.commenter_document"
            return [IsAuthenticated(), RequiresDjangoPerm()]
        if action == "commentaire_detail" and method in ("PATCH", "PUT", "DELETE"):
            self.required_permission = "gestion_documentaire.commenter_document"
            return [IsAuthenticated(), RequiresDjangoPerm()]

        return super().get_permissions()

    def get_queryset(self):
        return build_document_list_queryset(
            self.request.user,
            self.request.query_params,
            localite_id=self.request.query_params.get("localite"),
        )

    def perform_destroy(self, instance):
        """La suppression physique est assurée par le signal pre_delete sur DocumentLocalite."""
        instance.delete()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        try:
            offset = max(int(request.query_params.get("offset", 0)), 0)
            limit = min(max(int(request.query_params.get("limit", PAGE_SIZE)), 1), 100)
        except (TypeError, ValueError):
            offset = 0
            limit = PAGE_SIZE

        page = queryset[offset : offset + limit]
        from gestion_documentaire.services.localite_chemin import nodes_map_for_localite_ids

        localite_ids = [doc.localite_id for doc in page if doc.localite_id]
        serializer = self.get_serializer(
            page,
            many=True,
            context={
                **self.get_serializer_context(),
                "localite_nodes_map": nodes_map_for_localite_ids(localite_ids),
            },
        )
        return Response(
            {
                "results": serializer.data,
                "total": total,
                "offset": offset,
                "limit": limit,
                "has_more": offset + limit < total,
            }
        )

    @action(detail=False, methods=["get"], url_path="ids")
    def list_ids(self, request):
        """Identifiants des documents filtrés (sélection globale côté client)."""
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        try:
            offset = max(int(request.query_params.get("offset", 0)), 0)
            limit = min(max(int(request.query_params.get("limit", PAGE_SIZE)), 1), 500)
        except (TypeError, ValueError):
            offset = 0
            limit = PAGE_SIZE

        ids = list(queryset.values_list("id", flat=True)[offset : offset + limit])
        return Response(
            {
                "results": ids,
                "total": total,
                "offset": offset,
                "limit": limit,
                "has_more": offset + limit < total,
            }
        )

    @action(detail=False, methods=["get"], url_path="types-avec-documents")
    def types_avec_documents(self, request):
        """Types de documents ayant au moins un fichier (optionnellement filtrés par localité / statut QC)."""
        localite_id = request.query_params.get("localite")
        qs = filter_document_queryset(DocumentLocalite.objects.all(), request.user)
        if localite_id:
            qs = qs.filter(localite_id=localite_id)
        statut_qualite = request.query_params.get("statut_qualite", "").strip()
        if statut_qualite:
            if not user_can_filter_documents_by_statut(request.user, statut_qualite):
                return Response({"results": []})
            qs = qs.filter(statut_qualite=statut_qualite)

        rows = (
            qs.values(
                "type_document_id",
                "type_document__libelle",
                "type_document__code",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "type_document__libelle")
        )
        results = [
            {
                "id": row["type_document_id"],
                "libelle": row["type_document__libelle"],
                "code": row["type_document__code"],
                "count": row["count"],
            }
            for row in rows
        ]
        return Response({"results": results})

    @action(detail=False, methods=["get"], url_path="types-par-localite")
    def types_par_localite(self, request):
        """Types de documents ayant au moins un fichier sur la localité."""
        localite_id = request.query_params.get("localite")
        if not localite_id:
            return Response({"results": []})

        rows = (
            filter_document_queryset(DocumentLocalite.objects.all(), request.user)
            .filter(localite_id=localite_id)
            .values(
                "type_document_id",
                "type_document__libelle",
                "type_document__code",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "type_document__libelle")
        )
        results = [
            {
                "id": row["type_document_id"],
                "libelle": row["type_document__libelle"],
                "code": row["type_document__code"],
                "count": row["count"],
            }
            for row in rows
        ]
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="telecharger-archive")
    def telecharger_archive(self, request):
        """Télécharge plusieurs documents dans une archive RAR (ou ZIP si WinRAR absent)."""
        raw_ids = request.data.get("ids")
        if not isinstance(raw_ids, list) or len(raw_ids) < 2:
            return Response(
                {"detail": "Sélectionnez au moins 2 documents pour créer une archive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc_ids = [int(i) for i in raw_ids]
        except (TypeError, ValueError):
            return Response(
                {"detail": "Liste d'identifiants invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = filter_document_queryset(
            DocumentLocalite.objects.filter(id__in=doc_ids).select_related(
                "type_document", "localite"
            ),
            request.user,
        )
        documents = list(qs)
        if len(documents) < 2:
            return Response(
                {"detail": "Documents introuvables ou accès refusé."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            content, ext = build_documents_archive(documents)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "Impossible de créer l'archive."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        stamp = datetime.now().strftime("%Y-%m-%d")
        filename = f"documents-{stamp}{ext}"
        content_type = (
            "application/x-rar-compressed"
            if ext == ".rar"
            else "application/zip"
        )
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = (
            f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
        )
        response["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type"
        return response

    @action(detail=False, methods=["post"], url_path="extract-fields")
    def extract_fields(self, request):
        """Extrait automatiquement les valeurs des champs d'un document importé via OCR."""
        fichier = request.FILES.get("fichier")
        type_document_id = request.data.get("type_document")

        if not fichier:
            return Response(
                {"detail": "Aucun fichier fourni."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_document_upload(fichier)
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, "messages") else str(exc)
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        if not type_document_id:
            return Response(
                {"detail": "Le type de document est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            type_document = TypeDocument.objects.get(pk=type_document_id)
        except (TypeDocument.DoesNotExist, TypeError, ValueError):
            return Response(
                {"detail": "Type de document introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        champs = (
            ChampsDocument.objects.filter(type_document=type_document)
            .prefetch_related("options")
            .order_by("ordre")
        )
        champs_list = list(champs)
        zone_overrides = parse_zone_overrides(request.data.get("zone_overrides"))
        ocr_pages = parse_ocr_pages(request.data.get("ocr_pages"))
        if zone_overrides:
            champs_list = apply_zone_overrides(champs_list, zone_overrides)

        try:
            extracted: list[dict] = []
            methode = "libelle"
            ocr_result: dict = {}
            ocr_cache: dict = {}

            # Champs QR / code-barres : décodeurs dédiés (pas d'OCR texte)
            DECODER_TYPES = frozenset({"qr", "code_barre"})
            champs_qr = [c for c in champs_list if c.type_champ == "qr"]
            champs_code_barre = [c for c in champs_list if c.type_champ == "code_barre"]
            champs_ocr = [c for c in champs_list if c.type_champ not in DECODER_TYPES]
            qr_results: list[dict] = []
            code_barre_results: list[dict] = []
            if champs_qr:
                qr_results = extract_qr_field_values(
                    champs_qr,
                    fichier,
                    fichier.name,
                    ocr_pages=ocr_pages,
                )
                extracted.extend(qr_results)
                if qr_results:
                    methode = "qr"
            if champs_code_barre:
                code_barre_results = extract_barcode_field_values(
                    champs_code_barre,
                    fichier,
                    fichier.name,
                    ocr_pages=ocr_pages,
                )
                extracted.extend(code_barre_results)
                if code_barre_results:
                    methode = "code_barre" if not qr_results else f"{methode}+code_barre"

            champs_avec_zones = [c for c in champs_ocr if c.has_capture_zone]
            champs_sans_zones = [c for c in champs_ocr if not c.has_capture_zone]

            alignment_info = {"active": False, "pages": {}}
            compatibilite = None
            zone_results: list[dict] = []

            if champs_avec_zones:
                zone_results, alignment_info, ocr_cache = extract_field_values_by_zones(
                    champs_ocr,
                    fichier,
                    fichier.name,
                    type_document=type_document,
                    ocr_pages=ocr_pages,
                )
                extracted.extend(zone_results)
                methode = "zones"
                if alignment_info.get("active"):
                    methode = "zones+alignement"
                if qr_results:
                    methode = f"{methode}+qr"
                if code_barre_results and "code_barre" not in methode:
                    methode = f"{methode}+code_barre"

            # Repli par libellé uniquement pour les champs SANS zone configurée.
            # Ne pas deviner via le texte entier si une zone a échoué (document incompatible).
            label_champs = list(champs_sans_zones)
            if champs_avec_zones:
                zones_par_page: dict[int, list] = defaultdict(list)
                for champ in champs_avec_zones:
                    page_index = int(champ.capture_page or 0)
                    if ocr_pages is not None and page_index not in ocr_pages:
                        continue
                    zones_par_page[page_index].append(champ.id)

                filled_zone_ids = {
                    item["champ_id"] for item in zone_results if item.get("champ_id")
                }
                configured = sum(len(ids) for ids in zones_par_page.values())
                filled_zones = sum(
                    1
                    for champ_ids in zones_par_page.values()
                    for champ_id in champ_ids
                    if champ_id in filled_zone_ids
                )

                worst_ratio = 1.0
                if zones_par_page:
                    for champ_ids in zones_par_page.values():
                        if not champ_ids:
                            continue
                        page_filled = sum(1 for cid in champ_ids if cid in filled_zone_ids)
                        worst_ratio = min(worst_ratio, page_filled / len(champ_ids))

                ratio = filled_zones / configured if configured else 0.0
                if configured and worst_ratio < 0.35:
                    compatibilite = {
                        "score": round(ratio, 2),
                        "zones_configurees": configured,
                        "zones_remplies": filled_zones,
                        "message": (
                            "Le document importé ne semble pas correspondre au modèle de ce type. "
                            "Les zones de capture n'ont presque rien détecté — vérifiez le type "
                            "de document ou ajustez les zones sur l'aperçu."
                        ),
                    }
            if label_champs:
                if ocr_cache.get("lines"):
                    ocr_result = ocr_cache
                else:
                    ocr_result = extract_text_from_file(fichier, fichier.name)
                label_results = extract_field_values(label_champs, ocr_result)
                for item in label_results:
                    item["methode"] = "libelle"
                extracted.extend(label_results)
                if champs_avec_zones and label_results:
                    methode = "zones+libelle"
                elif not champs_avec_zones:
                    methode = ocr_result.get("method", "ocr")
                if qr_results and "qr" not in methode:
                    methode = f"{methode}+qr"
                if code_barre_results and "code_barre" not in methode:
                    methode = f"{methode}+code_barre"
            elif not champs_avec_zones:
                if champs_ocr:
                    ocr_result = extract_text_from_file(fichier, fichier.name)
                elif not qr_results and not code_barre_results:
                    methode = "aucune"

            return Response(
                {
                    "ocr_disponible": True,
                    "champs": extracted,
                    "texte_complet": ocr_result.get("full_text", ""),
                    "page_count": ocr_result.get("page_count", 0),
                    "methode": methode,
                    "zones_configurees": len(champs_avec_zones),
                    "qr_detectes": len(qr_results),
                    "code_barres_detectes": len(code_barre_results),
                    "alignement": alignment_info,
                    "compatibilite": compatibilite,
                }
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response(
                {
                    "ocr_disponible": False,
                    "champs": [],
                    "texte_complet": "",
                    "detail": str(exc),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            return Response(
                {"detail": "Erreur lors de l'extraction OCR du document."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="controle-qualite/soumettre",
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def soumettre_controle_qualite(self, request, pk=None):
        document = self.get_object()
        ancien_statut = document.statut_qualite
        serializer = DocumentControleQualiteSoumettreSerializer(
            document,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()  # ALLOWED — fichier validated in serializer (mime/content_type)

        from gestion_acces.services.notifications.notification_resoumission import (
            notifier_resoumission,
        )
        from gestion_acces.services.notifications.notification_soumission import (
            notifier_soumission,
        )

        notifier = (
            notifier_resoumission
            if ancien_statut == DocumentLocalite.STATUT_REJETE
            else notifier_soumission
        )
        notifier(document, actor=request.user)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="controle-qualite/valider",
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def valider_controle_qualite(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentControleQualiteValiderSerializer(
            document,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()  # ALLOWED — fichier validated in serializer (mime/content_type)

        from gestion_acces.services.notifications.notification_validation import (
            notifier_validation,
        )

        notifier_validation(document, actor=request.user)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="controle-qualite/rejeter",
        parser_classes=[parsers.JSONParser, parsers.FormParser],
    )
    def rejeter_controle_qualite(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentControleQualiteRejeterSerializer(
            document,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()  # ALLOWED — rejet metadata only

        from gestion_acces.services.notifications.notification_rejet import (
            notifier_rejet,
        )

        notifier_rejet(document, actor=request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="fichier")
    def fichier(self, request, pk=None):
        """
        Aperçu / lecture du fichier déchiffré (auth + permissions).
        Sans fusion d'annotations (l'UI les superpose côté client).
        """
        document = self.get_object()
        version_id = request.query_params.get("version_id")
        try:
            if version_id:
                version = document.versions.filter(pk=version_id).first()
                if not version or not version.fichier:
                    return Response(
                        {"detail": "Version introuvable."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                with version.fichier.open("rb") as handle:
                    content = handle.read()
                raw_name = os.path.basename(version.fichier.name) or f"document-{document.pk}.pdf"
            else:
                if not document.fichier:
                    return Response(
                        {"detail": "Fichier indisponible."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                with document.fichier.open("rb") as handle:
                    content = handle.read()
                raw_name = os.path.basename(document.fichier.name) or f"document-{document.pk}.pdf"
        except FileNotFoundError:
            return Response(
                {"detail": "Fichier indisponible."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            return Response(
                {"detail": "Impossible de lire le fichier."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        from gestion_documentaire.services.document_storage import download_display_filename

        filename = download_display_filename(raw_name, fallback=f"document-{document.pk}.pdf")
        content_type = "application/octet-stream"
        lower = filename.lower()
        if lower.endswith(".pdf"):
            content_type = "application/pdf"
        elif lower.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif lower.endswith(".png"):
            content_type = "image/png"

        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        """Télécharge le fichier courant ou une version archivée avec annotations fusionnées."""
        document = self.get_object()
        version_id = request.query_params.get("version_id")
        try:
            if version_id:
                version = document.versions.filter(pk=version_id).first()
                if not version:
                    return Response(
                        {"detail": "Version introuvable."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                content, filename, content_type = get_archived_version_download_payload(version)
            else:
                content, filename, content_type = get_document_download_payload(document)
        except FileNotFoundError:
            return Response(
                {"detail": "Fichier indisponible."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response["Pragma"] = "no-cache"
        return response

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        document = self.get_object()
        rows = dedupe_archived_versions(
            document.versions.select_related("created_by").all()
        )
        serializer = DocumentVersionSerializer(
            rows, many=True, context=self.get_serializer_context()
        )
        return Response(
            {
                "version_courante": document.version_courante,
                "results": serializer.data,
            }
        )

    @action(detail=True, methods=["get", "post"], url_path="commentaires")
    def commentaires(self, request, pk=None):
        document = self.get_object()
        if request.method == "GET":
            rows = document.commentaires.select_related("auteur").all()
            serializer = DocumentCommentSerializer(
                rows, many=True, context=self.get_serializer_context()
            )
            return Response({"results": serializer.data})

        serializer = DocumentCommentSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        comment = DocumentComment.objects.create(
            document=document,
            auteur=request.user,
            texte=serializer.validated_data["texte"],
        )
        out = DocumentCommentSerializer(comment, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"commentaires/(?P<commentaire_id>[0-9]+)",
    )
    def commentaire_detail(self, request, pk=None, commentaire_id=None):
        document = self.get_object()
        try:
            comment = document.commentaires.select_related("auteur").get(pk=commentaire_id)
        except DocumentComment.DoesNotExist:
            return Response({"detail": "Commentaire introuvable."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = comment.auteur_id == request.user.id
        if not is_owner and not request.user.is_superuser:
            return Response(
                {"detail": "Vous ne pouvez modifier ou supprimer que vos propres commentaires."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "DELETE":
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = DocumentCommentSerializer(
            comment,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        comment.texte = serializer.validated_data["texte"]
        comment.save(update_fields=["texte", "date_modification"])
        out = DocumentCommentSerializer(comment, context=self.get_serializer_context())
        return Response(out.data)

    def get_serializer_class(self):
        if self.action == "create":
            return DocumentLocaliteCreateSerializer
        if self.action in ("update", "partial_update"):
            return DocumentLocaliteUpdateSerializer
        return DocumentLocaliteSerializer
