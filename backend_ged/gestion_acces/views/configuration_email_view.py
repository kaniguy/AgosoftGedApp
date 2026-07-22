from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from gestion_acces.models.configuration_email import ConfigurationEmail
from gestion_acces.serializers.configuration_email_serializer import (
    ConfigurationEmailSerializer,
)


def _can_view(user):
    return user.is_superuser or user.has_perm("gestion_acces.view_configurationemail")


def _can_change(user):
    return user.is_superuser or user.has_perm("gestion_acces.change_configurationemail")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def configuration_email_view(request):
    if not _can_view(request.user) and not _can_change(request.user):
        return Response(
            {"detail": "Vous n'avez pas la permission de consulter la configuration e-mail."},
            status=status.HTTP_403_FORBIDDEN,
        )
    cfg = ConfigurationEmail.get_solo()
    serializer = ConfigurationEmailSerializer(cfg)
    return Response(serializer.data)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def configuration_email_update_view(request):
    if not _can_change(request.user):
        return Response(
            {"detail": "Vous n'avez pas la permission de modifier la configuration e-mail."},
            status=status.HTTP_403_FORBIDDEN,
        )
    cfg = ConfigurationEmail.get_solo()
    serializer = ConfigurationEmailSerializer(cfg, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
