from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models.user_signature import UserSignature
from ..serializers.user_signature_serializer import UserSignatureSerializer


class UserSignatureViewSet(viewsets.ModelViewSet):
    """CRUD des signatures du compte connecté."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSignatureSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return UserSignature.objects.filter(user=self.request.user)

    def get_serializer(self, *args, **kwargs):
        # Image non obligatoire sur PATCH (ex. changer seulement le mot de passe)
        if self.action in ("partial_update", "update"):
            kwargs.setdefault("partial", True)
        serializer = super().get_serializer(*args, **kwargs)
        if self.action in ("partial_update", "update"):
            serializer.fields["image"].required = False
        return serializer

    def perform_destroy(self, instance):
        was_default = instance.is_default
        user = instance.user
        if instance.image:
            instance.image.delete(save=False)
        instance.delete()
        if was_default:
            next_sig = UserSignature.objects.filter(user=user).first()
            if next_sig:
                next_sig.is_default = True
                next_sig.save(update_fields=["is_default"])

    @action(detail=True, methods=["post"])
    def set_default(self, request, pk=None):
        signature = self.get_object()
        UserSignature.objects.filter(user=request.user, is_default=True).update(is_default=False)
        signature.is_default = True
        signature.save(update_fields=["is_default"])
        serializer = self.get_serializer(signature)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="verify-password")
    def verify_password(self, request, pk=None):
        """Vérifie le mot de passe avant d'utiliser / placer la signature."""
        signature = self.get_object()
        password = request.data.get("password", "")
        if not signature.has_password:
            return Response({"ok": True, "has_password": False})
        if not signature.check_password(password):
            return Response(
                {"detail": "Mot de passe incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"ok": True, "has_password": True})
