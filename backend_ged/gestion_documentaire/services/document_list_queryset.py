"""Construction du queryset liste documents (filtres toolbar + colonnes)."""

from datetime import datetime

from django.db.models import Q

from gestion_acces.services.access_service import filter_document_queryset
from gestion_documentaire.models import DocumentLocalite
from gestion_documentaire.services.controle_qualite_access import user_can_filter_documents_by_statut
from gestion_documentaire.services.document_column_filters import FORMAT_EXTENSIONS, apply_column_filters


def query_param_str(query_params, key, default=""):
    """Valeur scalaire d'un paramètre (QueryDict, dict ou liste Django)."""
    if not query_params:
        return default
    value = query_params.get(key, default)
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        return str(value[0]).strip() if value else default
    return str(value).strip() if isinstance(value, str) else str(value)


def parse_date_param(value):
    if not value:
        return None
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip()[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def apply_champ_index_filters(qs, query_params):
    """Rétrocompatibilité : champ_<id> sans opérateur => contient."""
    applied = False
    for key in query_params:
        if not key.startswith("champ_") or key.endswith("_op") or key.endswith("_to"):
            continue
        if f"{key}_op" in query_params:
            continue
        value = query_param_str(query_params, key)
        if not value:
            continue
        try:
            champ_id = int(key[6:])
        except (TypeError, ValueError):
            continue
        from gestion_documentaire.services.document_column_filters import _champ_filter_q

        qs = qs.filter(_champ_filter_q(champ_id, "contains", value))
        applied = True
    return qs, applied


def has_document_list_filters(query_params):
    if not query_params:
        return False
    if query_param_str(query_params, "type_document"):
        return True
    if query_param_str(query_params, "q"):
        return True
    if query_param_str(query_params, "date_debut") or query_param_str(query_params, "date_fin"):
        return True
    if query_param_str(query_params, "format_fichier"):
        return True
    for key in query_params:
        if key.endswith("_op") or key.endswith("_to"):
            continue
        if key.startswith("filter_") or (
            key.startswith("champ_") and not key.endswith("_op") and not key.endswith("_to")
        ):
            if query_param_str(query_params, key):
                return True
    return False


def build_document_list_queryset(user, query_params, *, localite_id=None):
    """Applique les mêmes filtres que l'API GET /documents/."""
    qs = DocumentLocalite.objects.select_related(
        "localite",
        "localite__niveau",
        "type_document",
        "reponse",
        "created_by",
        "valide_par",
        "rejete_par",
    ).prefetch_related("reponse__valeurs__champ")
    if localite_id:
        qs = qs.filter(localite_id=localite_id)

    statut_qualite = query_param_str(query_params, "statut_qualite")
    if statut_qualite:
        if not user_can_filter_documents_by_statut(user, statut_qualite):
            return qs.none()
        qs = qs.filter(statut_qualite=statut_qualite)

    type_document_in = query_param_str(query_params, "type_document_in")
    type_document_id = query_param_str(query_params, "type_document")
    if type_document_in:
        ids = []
        for part in type_document_in.split(","):
            part = part.strip()
            if part.isdigit():
                ids.append(int(part))
        if ids:
            qs = qs.filter(type_document_id__in=ids)
    elif type_document_id:
        qs = qs.filter(type_document_id=type_document_id)

    search = query_param_str(query_params, "q")
    needs_distinct = False
    if search:
        qs = qs.filter(
            Q(localite__libelle__icontains=search)
            | Q(localite__code__icontains=search)
            | Q(type_document__libelle__icontains=search)
            | Q(type_document__code__icontains=search)
            | Q(reponse__valeurs__valeur__icontains=search)
        )
        needs_distinct = True

    qs, champ_filtered = apply_champ_index_filters(qs, query_params)
    if champ_filtered:
        needs_distinct = True

    qs, column_filtered = apply_column_filters(qs, query_params)
    if column_filtered:
        needs_distinct = True

    date_debut = parse_date_param(query_param_str(query_params, "date_debut") or None)
    if date_debut:
        qs = qs.filter(date_creation__date__gte=date_debut)

    date_fin = parse_date_param(query_param_str(query_params, "date_fin") or None)
    if date_fin:
        qs = qs.filter(date_creation__date__lte=date_fin)

    format_param = query_param_str(query_params, "format_fichier").lower()
    if format_param:
        extensions = FORMAT_EXTENSIONS.get(format_param, (f".{format_param}",))
        format_q = Q()
        for ext in extensions:
            format_q |= Q(fichier__iendswith=ext)
        qs = qs.filter(format_q)

    if needs_distinct:
        qs = qs.distinct()

    return filter_document_queryset(qs, user).order_by("-date_creation")
