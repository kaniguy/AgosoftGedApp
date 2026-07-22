from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from ..models.entreprise import Entreprise
from ..serializers.entreprise_serializer import EntrepriseSerializer


def _can_edit_entreprise(user):
    return user.is_superuser or user.has_perm("gestion_acces.change_entreprise")


@api_view(["GET"])
@permission_classes([AllowAny])
def entreprise_view(request):
    """Lecture publique du branding (page de connexion, en-tête)."""
    entreprise = Entreprise.get_solo()
    serializer = EntrepriseSerializer(entreprise, context={"request": request})
    return Response(serializer.data)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def entreprise_update_view(request):
    """Mise à jour du libellé et du logo (droits requis)."""
    if not _can_edit_entreprise(request.user):
        return Response(
            {"detail": "Vous n'avez pas la permission de modifier l'entreprise."},
            status=status.HTTP_403_FORBIDDEN,
        )

    entreprise = Entreprise.get_solo()
    serializer = EntrepriseSerializer(
        entreprise,
        data=request.data,
        partial=True,
        context={"request": request},
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def entreprise_reset_view(request):
    """Réinitialise l'identité visuelle aux valeurs par défaut."""
    if not _can_edit_entreprise(request.user):
        return Response(
            {"detail": "Vous n'avez pas la permission de modifier l'entreprise."},
            status=status.HTTP_403_FORBIDDEN,
        )

    entreprise = Entreprise.reset_to_defaults()
    serializer = EntrepriseSerializer(entreprise, context={"request": request})
    return Response(serializer.data)
