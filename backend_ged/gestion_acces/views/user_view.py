from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.contrib.auth.models import User
from ..serializers.user_management_serializer import UserManagementSerializer


class IsStaffOrSuperuser(IsAdminUser):
    """Autorise uniquement les utilisateurs is_staff ou is_superuser."""
    message = "Seuls les administrateurs peuvent gérer les utilisateurs."


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related("groups", "user_permissions").all()
    serializer_class = UserManagementSerializer

    def get_permissions(self):
        return [IsAuthenticated(), IsStaffOrSuperuser()]

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Réinitialise le mot de passe d'un utilisateur. Réservé aux admins."""
        new_password = request.data.get("new_password", "").strip()
        if not new_password:
            return Response(
                {"detail": "Le nouveau mot de passe est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 8:
            return Response(
                {"detail": "Le mot de passe doit comporter au moins 8 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = self.get_object()
        user.set_password(new_password)
        user.save()
        return Response({"detail": f"Mot de passe de « {user.username} » réinitialisé avec succès."})
