"""Classes de permission DRF basées sur les droits Django (groupes + utilisateur)."""

from rest_framework.permissions import DjangoModelPermissions, BasePermission


class GedDjangoModelPermissions(DjangoModelPermissions):
    """
    Exige les permissions Django natives (view/add/change/delete) selon la méthode HTTP.
    Les superutilisateurs conservent un accès complet.
    """

    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }


class HasDjangoPermission(BasePermission):
    """Vérifie une permission Django explicite (attribut `required_permission` sur la vue)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        codename = getattr(view, "required_permission", None)
        if not codename:
            return True
        return request.user.has_perm(codename)


class RequiresDjangoPerm(BasePermission):
    """Permission dynamique via `view.required_permission` (actions DRF)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        codename = getattr(view, "required_permission", None)
        if not codename:
            return True
        return request.user.has_perm(codename)
