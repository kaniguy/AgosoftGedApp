"""Authentification par jeton DRF avec durée de vie limitée."""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """Refuse les jetons trop anciens (TOKEN_TTL_HOURS)."""

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related("user").get(key=key)
        except model.DoesNotExist as exc:
            raise AuthenticationFailed(
                "Session expirée. Veuillez vous reconnecter."
            ) from exc

        if not token.user.is_active:
            raise AuthenticationFailed("Compte désactivé.")

        ttl_hours = int(getattr(settings, "TOKEN_TTL_HOURS", 12) or 12)
        if ttl_hours > 0:
            age = timezone.now() - token.created
            if age > timedelta(hours=ttl_hours):
                token.delete()
                raise AuthenticationFailed(
                    "Session expirée. Veuillez vous reconnecter."
                )

        return (token.user, token)
