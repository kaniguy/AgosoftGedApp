"""Services de calcul des droits d'accès (modules et plan géographique)."""

from gestion_acces.constants import VALID_MODULE_CODES, APP_MODULES
from parametrage.models import PlanGeographique


def _get_group_profiles(user):
    """Retourne les profils GED de tous les groupes de l'utilisateur."""
    profiles = []
    for group in user.groups.prefetch_related(
        "ged_profile__localites",
        "ged_profile__types_documents",
    ):
        profile = getattr(group, "ged_profile", None)
        if profile:
            profiles.append(profile)
    return profiles


def get_user_modules(user):
    """
    Retourne la liste des codes modules accessibles à l'utilisateur.
    Superuser : tous les modules. Sinon : union des modules des groupes.
    """
    if user.is_superuser:
        return [m["code"] for m in APP_MODULES]

    codes = set()
    for profile in _get_group_profiles(user):
        for code in profile.modules or []:
            if code in VALID_MODULE_CODES:
                codes.add(code)

    if not codes:
        return [m["code"] for m in APP_MODULES]

    return sorted(codes)


def get_user_leaf_localite_ids(user):
    """
    IDs des localités feuilles assignées via les groupes.
    None = pas de restriction géographique (superuser ou aucune localité configurée).
    """
    if user.is_superuser:
        return None

    ids = set()
    for profile in _get_group_profiles(user):
        ids.update(profile.localites.values_list("id", flat=True))

    if not ids:
        return None

    return ids


def get_allowed_plan_ids(user):
    """
    IDs autorisés dans le plan : ancêtres + localités feuilles assignées.
    Permet de dérouler l'arbre du parent racine jusqu'à la localité.
    """
    leaf_ids = get_user_leaf_localite_ids(user)
    if leaf_ids is None:
        return None

    allowed = set()
    for localite in PlanGeographique.objects.filter(id__in=leaf_ids).select_related("niveau"):
        for ancetre in localite.get_ancetres():
            allowed.add(ancetre.id)
        allowed.add(localite.id)

    return allowed


def get_user_permission_codenames(user):
    """
    Permissions effectives au format app_label.codename.
    None pour un superutilisateur (= toutes les permissions).
    """
    if user.is_superuser:
        return None
    return sorted(user.get_all_permissions())


def get_user_type_document_ids(user):
    """
    IDs des types de documents assignés via les groupes.
    None = pas de restriction (superuser ou aucun type configuré).
    """
    if user.is_superuser:
        return None

    ids = set()
    for profile in _get_group_profiles(user):
        ids.update(profile.types_documents.values_list("id", flat=True))

    if not ids:
        return None

    return ids


def filter_type_document_queryset(queryset, user):
    """Restreint la liste des types de documents aux types assignés au groupe."""
    if user.is_superuser:
        return queryset

    type_ids = get_user_type_document_ids(user)
    if type_ids is None:
        return queryset

    return queryset.filter(id__in=type_ids)


def filter_plan_queryset(queryset, user):
    """
    Restreint le plan géographique aux branches autorisées.
    Appliqué automatiquement dès qu'une localité feuille est assignée au groupe.
    """
    if user.is_superuser:
        return queryset

    allowed = get_allowed_plan_ids(user)
    if allowed is None:
        return queryset

    return queryset.filter(id__in=allowed)


def filter_document_queryset(queryset, user):
    """Restreint les documents aux localités et types autorisés via les groupes."""
    if user.is_superuser:
        return queryset

    leaf_ids = get_user_leaf_localite_ids(user)
    if leaf_ids is not None:
        queryset = queryset.filter(localite_id__in=leaf_ids)

    type_ids = get_user_type_document_ids(user)
    if type_ids is not None:
        queryset = queryset.filter(type_document_id__in=type_ids)

    return queryset


def filter_lot_brouillon_queryset(queryset, user):
    """Restreint les brouillons de rattachement aux localités et types autorisés."""
    if user.is_superuser:
        return queryset

    leaf_ids = get_user_leaf_localite_ids(user)
    if leaf_ids is not None:
        queryset = queryset.filter(localite_id__in=leaf_ids)

    type_ids = get_user_type_document_ids(user)
    if type_ids is not None:
        queryset = queryset.filter(type_document_id__in=type_ids)

    return queryset


def build_localite_chemin(localite):
    """Construit le chemin hiérarchique d'une localité (racine → feuille)."""
    chemin = [
        {
            "id": a.id,
            "libelle": a.libelle,
            "code": a.code,
            "niveau": a.niveau.libelle if a.niveau else "",
        }
        for a in localite.get_ancetres()
    ]
    chemin.append(
        {
            "id": localite.id,
            "libelle": localite.libelle,
            "code": localite.code,
            "niveau": localite.niveau.libelle if localite.niveau else "",
        }
    )
    return chemin


def get_user_localites_info(user):
    """
    Informations des localités assignées à l'utilisateur (pour le déroulement automatique).
    Chaque entrée contient id, libelle, code et chemin complet.
    """
    leaf_ids = get_user_leaf_localite_ids(user)
    if not leaf_ids:
        return []

    localites = PlanGeographique.objects.filter(id__in=leaf_ids).select_related("niveau")
    results = []
    for loc in localites:
        chemin = build_localite_chemin(loc)
        results.append(
            {
                "id": loc.id,
                "libelle": loc.libelle,
                "code": loc.code,
                "niveau": loc.niveau.libelle if loc.niveau else "",
                "chemin": chemin,
                "chemin_str": " > ".join(item["libelle"] for item in chemin),
            }
        )
    return results


def get_user_access_payload(user):
    """Payload modules, localités et permissions renvoyé à la connexion."""
    return {
        "modules": get_user_modules(user),
        "localites": get_user_localites_info(user),
        "permissions": get_user_permission_codenames(user),
        "is_superuser": user.is_superuser,
    }
