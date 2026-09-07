from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from gestion_acces.permissions import CanReadDocumentCatalog
from ..models.champs_document import ChampsDocument
from ..serializers.champs_document_serializer import ChampsDocumentSerializer


class ChampsDocumentViewSet(viewsets.ModelViewSet):
    """API CRUD des champs dynamiques associés à un type de document."""

    queryset = ChampsDocument.objects.all().prefetch_related("options")
    serializer_class = ChampsDocumentSerializer
    permission_classes = [IsAuthenticated, CanReadDocumentCatalog]

    def get_queryset(self):
        """Filtre optionnellement les champs par type de document."""
        queryset = super().get_queryset()
        type_document_id = self.request.query_params.get("type_document", None)
        if type_document_id is not None:
            queryset = queryset.filter(type_document_id=type_document_id)
        return queryset
