from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import Permission
from ..permissions import AccountAdminPermission
from ..serializers.permission_serializer import PermissionSerializer


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related("content_type").all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, AccountAdminPermission]
