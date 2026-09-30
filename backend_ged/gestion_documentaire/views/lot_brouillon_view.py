from rest_framework import mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
import os

from gestion_acces.permissions import GedDjangoModelPermissions, RequiresDjangoPerm
from gestion_acces.services.access_service import filter_lot_brouillon_queryset
from gestion_documentaire.models import ItemLotBrouillonRattachement, LotBrouillonRattachement
from gestion_documentaire.serializers.lot_brouillon_serializer import (
    LotBrouillonDetailSerializer,
    LotBrouillonListSerializer,
    LotBrouillonSyncSerializer,
)
from gestion_documentaire.services.document_download_service import guess_document_content_type
from gestion_documentaire.services.document_storage import download_display_filename
from gestion_documentaire.services.localite_chemin import nodes_map_for_localite_ids


class LotBrouillonRattachementViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Lots de rattachement non soumis — partagés par localité entre utilisateurs autorisés."""

    permission_classes = [IsAuthenticated]

    ACTION_PERMISSIONS = {
        "list": "gestion_documentaire.view_documentlocalite",
        "retrieve": "gestion_documentaire.view_documentlocalite",
        "sync": "gestion_documentaire.add_documentlocalite",
        "destroy": "gestion_documentaire.delete_documentlocalite",
        "item_fichier": "gestion_documentaire.view_documentlocalite",
    }

    def get_permissions(self):
        perm = self.ACTION_PERMISSIONS.get(getattr(self, "action", None))
        if perm:
            self.required_permission = perm
            return [IsAuthenticated(), RequiresDjangoPerm()]
        return [IsAuthenticated(), GedDjangoModelPermissions()]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = (
            LotBrouillonRattachement.objects.select_related(
                "localite",
                "localite__niveau",
                "type_document",
                "utilisateur",
            )
            .prefetch_related("items")
        )
        return filter_lot_brouillon_queryset(qs, self.request.user).order_by("-date_modification")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return LotBrouillonDetailSerializer
        if self.action == "sync":
            return LotBrouillonSyncSerializer
        return LotBrouillonListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            localite_ids = list(
                self.get_queryset().order_by().values_list("localite_id", flat=True).distinct()
            )
            ctx["localite_chemin_map"] = nodes_map_for_localite_ids(localite_ids)
        elif self.action == "retrieve" and self.kwargs.get("pk"):
            try:
                lot = self.get_queryset().get(pk=self.kwargs["pk"])
                ctx["localite_chemin_map"] = nodes_map_for_localite_ids([lot.localite_id])
            except LotBrouillonRattachement.DoesNotExist:
                ctx["localite_chemin_map"] = {}
        return ctx

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        serializer = LotBrouillonSyncSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        lot = serializer.save()
        if lot is None:
            return Response({"deleted": True}, status=status.HTTP_200_OK)
        chemin_map = nodes_map_for_localite_ids([lot.localite_id])
        data = LotBrouillonDetailSerializer(
            lot, context={"request": request, "localite_chemin_map": chemin_map}
        ).data
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path=r"items/(?P<item_id>[^/.]+)/fichier")
    def item_fichier(self, request, item_id=None):
        """Aperçu déchiffré d'un fichier d'item de lot brouillon."""
        item = (
            ItemLotBrouillonRattachement.objects.select_related("lot")
            .filter(pk=item_id)
            .first()
        )
        if not item or not item.fichier:
            return Response({"detail": "Fichier introuvable."}, status=status.HTTP_404_NOT_FOUND)

        allowed_lots = filter_lot_brouillon_queryset(
            LotBrouillonRattachement.objects.filter(pk=item.lot_id),
            request.user,
        )
        if not allowed_lots.exists():
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        try:
            with item.fichier.open("rb") as handle:
                content = handle.read()
        except Exception:
            return Response(
                {"detail": "Impossible de lire le fichier."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        raw = item.nom_fichier or os.path.basename(item.fichier.name) or f"brouillon-{item.pk}.pdf"
        filename = download_display_filename(raw, fallback=f"brouillon-{item.pk}.pdf")
        content_type = guess_document_content_type(filename, item.fichier.name, content=content)

        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        response["Cache-Control"] = "private, no-store"
        return response
