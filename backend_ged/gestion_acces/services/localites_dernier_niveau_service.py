"""Chargement performant des localités feuilles (contrôle qualité, groupes)."""

from functools import lru_cache

from django.db.models import Count, Max

from gestion_acces.services.access_service import (
    filter_document_queryset,
    get_user_leaf_localite_ids,
)
from gestion_documentaire.models import DocumentLocalite
from gestion_documentaire.services.document_list_queryset import (
    build_document_list_queryset,
    has_document_list_filters,
    query_param_str,
)
from gestion_documentaire.services.localite_chemin import (
    build_chemin_from_map,
    nodes_map_for_localite_ids,
)
from parametrage.models.plan_geographique import PlanGeographique
from parametrage.models.structure_geographique import StructureGeographique


@lru_cache(maxsize=1)
def get_max_niveau_ordre():
    return StructureGeographique.objects.aggregate(m=Max("ordre"))["m"] or 0


def _allowed_leaf_ids(user, filtrer_acces):
    if not filtrer_acces:
        return None
    return get_user_leaf_localite_ids(user)


def _feuilles_queryset(max_ordre, allowed_ids=None, query=""):
    qs = PlanGeographique.objects.filter(niveau__ordre=max_ordre).select_related(
        "niveau", "parent"
    )
    if allowed_ids is not None:
        qs = qs.filter(id__in=allowed_ids)
    if query:
        q_lower = query.lower()
        from django.db.models import Q

        qs = qs.filter(
            Q(libelle__icontains=q_lower) | Q(code__icontains=q_lower)
        )
    return qs


def _document_counts(user, localite_ids=None):
    qs = filter_document_queryset(DocumentLocalite.objects.all(), user)
    if localite_ids is not None:
        if not localite_ids:
            return {}, {}
        qs = qs.filter(localite_id__in=localite_ids)

    by_localite = {}
    totaux = {}
    for row in qs.order_by().values("localite_id", "statut_qualite").annotate(nb=Count("id")):
        loc_id = row["localite_id"]
        statut = row["statut_qualite"]
        nb = row["nb"]
        by_localite.setdefault(loc_id, {})[statut] = nb
        totaux[statut] = totaux.get(statut, 0) + nb
    return by_localite, totaux


def _totaux_par_statut(totaux_all, statuts_qc):
    return {s: totaux_all.get(s, 0) for s in statuts_qc}


def _format_chemin(localite_id, nodes_map):
    chain = build_chemin_from_map(localite_id, nodes_map)
    chemin = []
    for item in chain:
        node = nodes_map.get(item["id"])
        chemin.append(
            {
                "id": item["id"],
                "libelle": item["libelle"],
                "code": (node.code if node else "") or "",
                "niveau": item.get("niveau_libelle") or "",
            }
        )
    chemin_str = " > ".join(n["libelle"] for n in chemin)
    return chemin, chemin_str


def _sort_key(loc, nodes_map):
    chain = []
    current = loc
    while current:
        chain.insert(0, current.id)
        current = nodes_map.get(current.parent_id) if current.parent_id else None
    return chain


def _build_result(loc, nodes_map, count_by_localite, statuts_qc, statut_qualite):
    chemin, chemin_str = _format_chemin(loc.id, nodes_map)
    nb_par_statut = {s: count_by_localite.get(loc.id, {}).get(s, 0) for s in statuts_qc}
    if statut_qualite:
        nb_documents = nb_par_statut.get(statut_qualite, 0)
    else:
        nb_documents = nb_par_statut.get(DocumentLocalite.STATUT_EN_ATTENTE, 0)
    return {
        "id": loc.id,
        "libelle": loc.libelle,
        "code": loc.code,
        "niveau": loc.niveau.libelle if loc.niveau else "",
        "chemin": chemin,
        "chemin_str": chemin_str,
        "nb_documents": nb_documents,
        "nb_par_statut": nb_par_statut,
    }


def build_localites_dernier_niveau_payload(
    user,
    *,
    query="",
    filtrer_acces=False,
    statut_qualite="",
    avec_documents=False,
    totaux_seulement=False,
    statuts_qc,
    document_query_params=None,
):
    allowed = _allowed_leaf_ids(user, filtrer_acces)
    if allowed is not None and not allowed:
        empty_totaux = {s: 0 for s in statuts_qc}
        return {"results": [], "totaux_par_statut": empty_totaux}

    if totaux_seulement:
        _, totaux_all = _document_counts(user, allowed)
        return {"results": [], "totaux_par_statut": _totaux_par_statut(totaux_all, statuts_qc)}

    max_ordre = get_max_niveau_ordre()
    query_params = document_query_params or {}
    document_filters_active = has_document_list_filters(query_params)
    restrict_to_matching_docs = bool(statut_qualite and avec_documents) or document_filters_active

    if restrict_to_matching_docs:
        if document_query_params is not None:
            params = document_query_params.copy()
            params._mutable = True
        else:
            from django.http import QueryDict

            params = QueryDict(mutable=True)
        if statut_qualite and not query_param_str(params, "statut_qualite"):
            params["statut_qualite"] = statut_qualite
        doc_qs = build_document_list_queryset(user, params)
        if allowed is not None:
            doc_qs = doc_qs.filter(localite_id__in=allowed)

        count_rows = list(
            doc_qs.order_by().values("localite_id").annotate(nb=Count("id"))
        )
        active_ids = [row["localite_id"] for row in count_rows if row["nb"] > 0]
        if not active_ids:
            _, totaux_all = _document_counts(user, allowed)
            return {
                "results": [],
                "totaux_par_statut": _totaux_par_statut(totaux_all, statuts_qc),
            }

        feuilles = list(
            PlanGeographique.objects.filter(
                id__in=active_ids,
                niveau__ordre=max_ordre,
            ).select_related("niveau", "parent")
        )
        if query:
            q_lower = query.lower()
            feuilles = [
                loc
                for loc in feuilles
                if q_lower in (loc.libelle or "").lower()
                or q_lower in (loc.code or "").lower()
            ]
        leaf_ids = [loc.id for loc in feuilles]
        nodes_map = nodes_map_for_localite_ids(leaf_ids)
        active_statut = statut_qualite or DocumentLocalite.STATUT_EN_ATTENTE
        count_by_localite = {}
        filtered_total = 0
        for row in count_rows:
            loc_id = row["localite_id"]
            if loc_id not in leaf_ids or row["nb"] <= 0:
                continue
            count_by_localite.setdefault(loc_id, {})[active_statut] = row["nb"]
            filtered_total += row["nb"]
        totaux_all = {active_statut: filtered_total}
    else:
        feuilles = list(_feuilles_queryset(max_ordre, allowed, query))
        leaf_ids = [loc.id for loc in feuilles]
        nodes_map = nodes_map_for_localite_ids(leaf_ids)
        count_by_localite, totaux_all = _document_counts(user, leaf_ids)

    feuilles.sort(key=lambda loc: _sort_key(loc, nodes_map))
    totaux_par_statut = _totaux_par_statut(totaux_all, statuts_qc)

    results = [
        _build_result(loc, nodes_map, count_by_localite, statuts_qc, statut_qualite)
        for loc in feuilles
    ]
    return {"results": results, "totaux_par_statut": totaux_par_statut}
