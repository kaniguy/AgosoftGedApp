"""Classes de permission DRF basées sur les droits Django (groupes + utilisateur)."""

from rest_framework.permissions import DjangoModelPermissions, BasePermission, SAFE_METHODS

from gestion_acces.services.access_service import get_user_modules

GUIDE_AIDE_VIEW = "gestion_acces.view_guideaide"
GUIDE_AIDE_ADD = "gestion_acces.add_guideaide"
GUIDE_AIDE_CHANGE = "gestion_acces.change_guideaide"
GUIDE_AIDE_DELETE = "gestion_acces.delete_guideaide"


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


class GuideAidePermission(BasePermission):
    """
    Lecture : module Aide Vidéo ou permission de consultation.
    Écriture : permissions Django add / change / delete.
    """

    message = "Vous n'avez pas accès aux guides d'aide."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if request.method in SAFE_METHODS:
            return "aide_video" in get_user_modules(user) or user.has_perm(GUIDE_AIDE_VIEW)
        needed = {
            "POST": GUIDE_AIDE_ADD,
            "PUT": GUIDE_AIDE_CHANGE,
            "PATCH": GUIDE_AIDE_CHANGE,
            "DELETE": GUIDE_AIDE_DELETE,
        }.get(request.method)
        return bool(needed and user.has_perm(needed))
