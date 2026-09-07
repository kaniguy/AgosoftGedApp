"""Backend d'authentification GED : ignore les permissions des groupes désactivés."""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import Permission
from django.db.models import Q


class GedModelBackend(ModelBackend):
    """Comme ModelBackend, mais un groupe inactif n'accorde plus de permissions Django."""

    def _get_group_permissions(self, user_obj):
        return Permission.objects.filter(
            Q(group__user=user_obj)
            & (
                Q(group__ged_profile__is_active=True)
                | Q(group__ged_profile__isnull=True)
            )
        )
