"""Services de calcul des droits d'accès (modules et plan de classement)."""

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q

from gestion_acces.constants import VALID_MODULE_CODES, APP_MODULES
from parametrage.models import PlanGeographique


def _iter_user_group_profiles(user):
    """Tous les profils GED des groupes de l'utilisateur (actifs et inactifs)."""
    for group in user.groups.select_related("ged_profile").prefetch_related(
        "ged_profile__localites",
        "ged_profile__types_documents",
    ):
        profile = getattr(group, "ged_profile", None)
        if profile is not None:
            yield profile


def _get_group_profiles(user, *, active_only=True):
    """Profils GED des groupes. Par défaut, uniquement les groupes actifs."""
    profiles = list(_iter_user_group_profiles(user))
    if active_only:
        return [p for p in profiles if p.is_active]
    return profiles


def get_user_modules(user):
    """
    Codes modules visibles sur le tableau de bord.
    Superuser / aucun groupe : tous les modules.
    Sinon : union des modules des groupes (y compris désactivés) pour garder
    les cartes ; l'entrée dans le module reste bloquée sans permissions actives.
    """
    if user.is_superuser:
        return [m["code"] for m in APP_MODULES]

    profiles = _get_group_profiles(user, active_only=False)
    if not profiles:
        return [m["code"] for m in APP_MODULES]

    codes = set()
    active_unrestricted = False
    for profile in profiles:
        mods = [c for c in (profile.modules or []) if c in VALID_MODULE_CODES]
        if not mods:
            if profile.is_active:
                active_unrestricted = True
            continue
        codes.update(mods)

    if active_unrestricted:
        return [m["code"] for m in APP_MODULES]
    return sorted(codes)


def get_user_leaf_localite_ids(user):
    """
    IDs des localités feuilles assignées via les groupes.
    None = pas de restriction géographique (superuser ou aucune localité configurée).
    set() = groupes présents mais tous inactifs (aucun accès).
    """
    if user.is_superuser:
        return None

    all_profiles = _get_group_profiles(user, active_only=False)
    if not all_profiles:
        return None

    active = [p for p in all_profiles if p.is_active]
    if not active:
        return set()

    ids = set()
    for profile in active:
        ids.update(profile.localites.values_list("id", flat=True))

    if not ids:
        return None

    return ids


def get_user_accessible_leaf_localite_ids(user):
    """
    Localités où l'utilisateur peut voir documents et brouillons :
    nœuds assignés au groupe + tous leurs descendants.
    None = pas de restriction.
    """
    assigned = get_user_leaf_localite_ids(user)
    if assigned is None:
        return None

    ids = set(assigned)
    pending = set(assigned)
    while pending:
        child_ids = set(
            PlanGeographique.objects.filter(parent_id__in=pending).values_list("id", flat=True)
        )
        pending = child_ids - ids
        ids.update(pending)
    return ids


def get_allowed_plan_ids(user):
    """
    IDs autorisés dans le plan : ancêtres + localités feuilles assignées.
    Remonte les parents par lots (pas une requête par nœud).
    """
    leaf_ids = get_user_leaf_localite_ids(user)
    if leaf_ids is None:
        return None

    allowed = set(leaf_ids)
    pending = set(leaf_ids)
    while pending:
        parent_ids = set(
            PlanGeographique.objects.filter(id__in=pending)
            .exclude(parent_id__isnull=True)
            .values_list("parent_id", flat=True)
        )
        pending = parent_ids - allowed
        allowed.update(pending)
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
    set() = groupes présents mais tous inactifs (aucun type).
    """
    if user.is_superuser:
        return None

    all_profiles = _get_group_profiles(user, active_only=False)
    if not all_profiles:
        return None

    active = [p for p in all_profiles if p.is_active]
    if not active:
        return set()

    ids = set()
    for profile in active:
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
    Restreint le plan de classement aux branches autorisées.
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

    leaf_ids = get_user_accessible_leaf_localite_ids(user)
    if leaf_ids is not None:
        queryset = queryset.filter(localite_id__in=leaf_ids)

    type_ids = get_user_type_document_ids(user)
    if type_ids is not None:
        queryset = queryset.filter(type_document_id__in=type_ids)

    return queryset


def filter_lot_brouillon_queryset(queryset, user):
    """Brouillons des localités accessibles, plus ceux créés par l'utilisateur."""
    if user.is_superuser:
        return queryset

    leaf_ids = get_user_accessible_leaf_localite_ids(user)
    if leaf_ids is not None:
        queryset = queryset.filter(Q(localite_id__in=leaf_ids) | Q(utilisateur_id=user.id))

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
        "suggest_password_change": _suggest_password_change(user),
    }


def _suggest_password_change(user):
    try:
        return bool(user.profile.suggest_password_change)
    except ObjectDoesNotExist:
        return False
