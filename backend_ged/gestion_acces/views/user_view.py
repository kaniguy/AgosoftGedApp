from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from ..permissions import AccountAdminPermission, HasDjangoPermission
from ..serializers.user_management_serializer import UserManagementSerializer
from gestion_acces.services.user_credentials_service import mark_password_prompt


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related("groups", "user_permissions").all()
    serializer_class = UserManagementSerializer

    def get_permissions(self):
        if self.action == "reset_password":
            self.required_permission = "auth.change_user"
            return [IsAuthenticated(), HasDjangoPermission()]
        return [IsAuthenticated(), AccountAdminPermission()]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if (
            request.method not in SAFE_METHODS
            and obj.is_superuser
            and not request.user.is_superuser
        ):
            raise PermissionDenied(
                "Seul un superutilisateur peut modifier, réinitialiser ou supprimer "
                "un compte superutilisateur."
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        data = dict(serializer.data)
        result = getattr(serializer.instance, "_credential_result", None)
        if result:
            data["password_delivery"] = result.status
            data["password_delivery_detail"] = result.detail
            if result.generated_password and result.status != "emailed":
                data["generated_password"] = result.generated_password
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Réinitialise le mot de passe d'un utilisateur. Réservé aux admins."""
        new_password = request.data.get("new_password", "").strip()
        if not new_password:
            return Response(
                {"detail": "Le nouveau mot de passe est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = self.get_object()
        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response(
                {"detail": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save()
        mark_password_prompt(user, enabled=True)
        return Response({"detail": f"Mot de passe de « {user.username} » réinitialisé avec succès."})
