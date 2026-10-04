from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from gestion_acces.permissions import CanReadDocumentCatalog
from ..models import PlanGeographique, StructureGeographique
from ..serializers.structure_geographique_serializer import StructureGeographiqueSerializer

class StructureGeographiqueViewSet(viewsets.ModelViewSet):
    queryset = StructureGeographique.objects.all().order_by('ordre')
    serializer_class = StructureGeographiqueSerializer
    permission_classes = [IsAuthenticated, CanReadDocumentCatalog]

    def destroy(self, request, *args, **kwargs):
        """Suppression ascendante : dernier niveau d'abord, et seulement s'il n'est plus utilisé."""
        niveau = self.get_object()

        niveau_inferieur = (
            StructureGeographique.objects.filter(ordre__gt=niveau.ordre).order_by("-ordre").first()
        )
        if niveau_inferieur:
            return Response(
                {
                    "detail": f"Impossible de supprimer le niveau « {niveau.libelle} » : supprimez "
                    f"d'abord les niveaux inférieurs, en commençant par le dernier "
                    f"(« {niveau_inferieur.libelle} »)."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        nb_localites = PlanGeographique.objects.filter(niveau=niveau).count()
        if nb_localites:
            return Response(
                {
                    "detail": f"Impossible de supprimer le niveau « {niveau.libelle} » : "
                    f"{nb_localites} localité(s) du plan de classement l'utilisent. Supprimez "
                    "d'abord ces localités."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        niveau.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
