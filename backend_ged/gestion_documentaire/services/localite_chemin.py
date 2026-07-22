"""Chemin hiérarchique d'une localité (ancêtres + feuille) pour l'affichage tabulaire."""
from parametrage.models.plan_geographique import PlanGeographique


def _serialize_node(node):
    return {
        "id": node.id,
        "libelle": node.libelle,
        "niveau_ordre": node.niveau.ordre if node.niveau_id else None,
        "niveau_libelle": node.niveau.libelle if node.niveau_id else "",
    }


def build_chemin_from_map(localite_id, nodes_map):
    """Reconstruit le chemin complet à partir d'une map id → PlanGeographique."""
    if not localite_id or localite_id not in nodes_map:
        return []
    chain = []
    current = nodes_map.get(localite_id)
    while current:
        chain.append(current)
        current = nodes_map.get(current.parent_id) if current.parent_id else None
    chain.reverse()
    return [_serialize_node(node) for node in chain]


def nodes_map_for_localite_ids(localite_ids):
    """Charge les nœuds et leurs ancêtres pour une liste de localités."""
    ids = {int(i) for i in localite_ids if i}
    if not ids:
        return {}

    nodes = {
        n.id: n
        for n in PlanGeographique.objects.filter(id__in=ids).select_related("niveau")
    }
    while True:
        parent_ids = {
            node.parent_id
            for node in nodes.values()
            if node.parent_id and node.parent_id not in nodes
        }
        if not parent_ids:
            break
        for node in PlanGeographique.objects.filter(id__in=parent_ids).select_related(
            "niveau"
        ):
            nodes[node.id] = node
    return nodes


def _text_match_single(field_value, op, value):
    """Évalue un opérateur texte sur une chaîne (miroir de _text_q côté ORM)."""
    field_value = (field_value or "").strip()
    value = (value or "").strip()
    if not value:
        return True
    f_lower = field_value.lower()
    v_lower = value.lower()
    if op == "contains":
        return v_lower in f_lower
    if op == "not_contains":
        return v_lower not in f_lower
    if op == "eq":
        return f_lower == v_lower
    if op == "neq":
        return f_lower != v_lower
    if op == "startswith":
        return f_lower.startswith(v_lower)
    if op == "endswith":
        return f_lower.endswith(v_lower)
    return v_lower in f_lower


def _plan_node_matches(node, op, value):
    parts = [node.libelle or "", node.code or ""]
    if op in ("not_contains", "neq"):
        return all(_text_match_single(part, op, value) for part in parts)
    return any(_text_match_single(part, op, value) for part in parts)


def _collect_leaf_ids_under(node_id, children_map):
    children = children_map.get(node_id, [])
    if not children:
        return [node_id]
    leaf_ids = []
    for child_id in children:
        leaf_ids.extend(_collect_leaf_ids_under(child_id, children_map))
    return leaf_ids


def _build_plan_tree():
    nodes = list(PlanGeographique.objects.select_related("niveau").all())
    children_map = {}
    for node in nodes:
        if node.parent_id:
            children_map.setdefault(node.parent_id, []).append(node.id)
    return nodes, children_map


def leaf_localite_ids_for_geo_level(niveau_ordre, op, value):
    """
    Retourne les ids des localités feuilles dont l'ancêtre au niveau `niveau_ordre`
    correspond au filtre texte.
    """
    value = (value or "").strip()
    if not value:
        return None

    nodes, children_map = _build_plan_tree()
    matching_roots = [
        node.id
        for node in nodes
        if node.niveau_id and node.niveau.ordre == niveau_ordre and _plan_node_matches(node, op, value)
    ]

    leaf_ids = set()
    for node_id in matching_roots:
        leaf_ids.update(_collect_leaf_ids_under(node_id, children_map))

    return leaf_ids


def geo_level_filter_q(niveau_ordre, op, value):
    """Construit un Q Django pour filtrer les documents par niveau géographique."""
    from gestion_documentaire.services.document_column_filters import _impossible_q

    if op not in {
        "contains",
        "not_contains",
        "eq",
        "neq",
        "startswith",
        "endswith",
    }:
        op = "contains"

    leaf_ids = leaf_localite_ids_for_geo_level(niveau_ordre, op, value)
    if leaf_ids is None:
        return None
    if op in ("not_contains", "neq"):
        if not leaf_ids:
            return None
        from django.db.models import Q

        return ~Q(localite_id__in=leaf_ids)
    if not leaf_ids:
        return _impossible_q()
    from django.db.models import Q

    return Q(localite_id__in=leaf_ids)

