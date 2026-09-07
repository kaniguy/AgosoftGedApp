from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from gestion_acces.permissions import CanReadDocumentCatalog
from ..models import StructureGeographique
from ..serializers.structure_geographique_serializer import StructureGeographiqueSerializer

class StructureGeographiqueViewSet(viewsets.ModelViewSet):
    queryset = StructureGeographique.objects.all().order_by('ordre')
    serializer_class = StructureGeographiqueSerializer
    permission_classes = [IsAuthenticated, CanReadDocumentCatalog]