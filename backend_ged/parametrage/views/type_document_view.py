from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.file_validation import validate_document_upload
from django.core.exceptions import ValidationError as DjangoValidationError
from gestion_acces.permissions import GedDjangoModelPermissions
from gestion_acces.services.access_service import filter_type_document_queryset
from gestion_documentaire.services.ocr_service import get_page_count_from_bytes

from ..models import TypeDocument
from ..models.champs_document import ChampsDocument
from ..serializers.champs_document_serializer import (
    CaptureZonesBulkSerializer,
    ChampsDocumentSerializer,
)
from ..serializers.type_document_serializer import TypeDocumentSerializer


class TypeDocumentViewSet(viewsets.ModelViewSet):
    queryset = TypeDocument.objects.all()
    serializer_class = TypeDocumentSerializer
    permission_classes = [IsAuthenticated, GedDjangoModelPermissions]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = TypeDocument.objects.all().prefetch_related("champs")
        return filter_type_document_queryset(qs, self.request.user)

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="modele-capture",
        parser_classes=[MultiPartParser, FormParser],
    )
    def modele_capture(self, request, pk=None):
        """Upload (POST) ou supprime (DELETE) le document modèle de capture."""
        if request.method == "DELETE":
            return self._delete_modele_capture(request, pk)
        return self._upload_modele_capture(request, pk)

    def _upload_modele_capture(self, request, pk=None):
        """Upload ou remplace le document modèle de capture pour un type."""
        type_document = self.get_object()
        fichier = request.FILES.get("fichier")

        if not fichier:
            return Response(
                {"detail": "Aucun fichier fourni."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_document_upload(fichier, label="modèle")
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, "messages") else str(exc)
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        if type_document.fichier_modele:
            type_document.fichier_modele.delete(save=False)

        file_bytes = fichier.read()
        if hasattr(fichier, "seek"):
            fichier.seek(0)

        type_document.fichier_modele = fichier
        type_document.modele_page_count = get_page_count_from_bytes(file_bytes, fichier.name)
        type_document.save(update_fields=["fichier_modele", "modele_page_count"])  # ALLOWED mime validated above

        serializer = self.get_serializer(type_document)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _delete_modele_capture(self, request, pk=None):
        """Supprime le document modèle de capture d'un type."""
        type_document = self.get_object()

        if type_document.fichier_modele:
            type_document.fichier_modele.delete(save=False)
            type_document.fichier_modele = None
            type_document.modele_page_count = 0
            type_document.save(update_fields=["fichier_modele", "modele_page_count"])  # ALLOWED — modèle removed

        serializer = self.get_serializer(type_document)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "put"], url_path="capture-zones")
    def capture_zones(self, request, pk=None):
        """Lit (GET) ou enregistre (PUT) les zones de capture d'un type de document."""
        if request.method == "PUT":
            return self._update_capture_zones(request, pk)
        return self._get_capture_zones(request, pk)

    def _get_capture_zones(self, request, pk=None):
        """Retourne les champs et leurs zones de capture pour un type de document."""
        type_document = self.get_object()
        champs = (
            ChampsDocument.objects.filter(type_document=type_document)
            .prefetch_related("options")
            .order_by("ordre")
        )
        serializer = ChampsDocumentSerializer(champs, many=True)
        type_serializer = self.get_serializer(type_document)
        return Response({
            "type_document": type_serializer.data,
            "champs": serializer.data,
        })

    def _update_capture_zones(self, request, pk=None):
        """Enregistre en masse les zones de capture des champs d'un type."""
        type_document = self.get_object()
        payload = CaptureZonesBulkSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        zones = payload.validated_data["zones"]
        champ_ids = [item["champ_id"] for item in zones]
        champs_by_id = {
            champ.id: champ
            for champ in ChampsDocument.objects.filter(
                type_document=type_document,
                id__in=champ_ids,
            )
        }

        updated = []
        for item in zones:
            champ = champs_by_id.get(item["champ_id"])
            if champ is None:
                continue

            champ.capture_page = item.get("capture_page", 0)
            for key in ("zone_x", "zone_y", "zone_width", "zone_height"):
                if key in item:
                    setattr(champ, key, item[key])
            champ.save()  # ALLOWED — zones metadata only, no file upload
            updated.append(champ)

        serializer = ChampsDocumentSerializer(updated, many=True)
        return Response({"updated": serializer.data})
