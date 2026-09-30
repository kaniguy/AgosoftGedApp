from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import TypeDocument
from ..models.champs_document import ChampsDocument
from ..models.plan_geographique import PlanGeographique
from ..models.structure_geographique import StructureGeographique


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def etat_parametrage_view(request):
    """
    Avancement du paramétrage, dans l'ordre imposé :
    structures → plan de classement → types de documents → champs.
    """
    return Response(
        {
            "structures": StructureGeographique.objects.count(),
            "plans": PlanGeographique.objects.count(),
            "types_documents": TypeDocument.objects.count(),
            "champs_documents": ChampsDocument.objects.count(),
        }
    )
