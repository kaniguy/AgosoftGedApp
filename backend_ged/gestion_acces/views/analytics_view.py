from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Count, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gestion_acces.models.group_profile import GroupProfile
from gestion_acces.models.lien_telechargement import LienTelechargement
from gestion_acces.models.notification import EvenementNotification, NotificationEmailLog
from gestion_documentaire.models import DocumentLocalite
from parametrage.models.champs_document import TypeDocument
from parametrage.models.plan_geographique import PlanGeographique

User = get_user_model()

STATUT_LABELS = {
    "en_attente": "En attente",
    "valide": "Validé",
    "rejete": "Rejeté",
}

EVENT_LABELS = dict(EvenementNotification.choices)
NOTIF_STATUT_LABELS = dict(NotificationEmailLog.Statut.choices)


def _parse_period(request):
    """Retourne (date_debut, date_fin, periode_code)."""
    periode = (request.query_params.get("periode") or "365").strip()
    now = timezone.now()
    mapping = {
        "7": 7,
        "30": 30,
        "90": 90,
        "180": 180,
        "365": 365,
    }
    days = mapping.get(periode)
    if days is None:
        return None, None, "all"
    return now - timedelta(days=days), now, periode


def _document_queryset(request):
    qs = DocumentLocalite.objects.exclude(statut_qualite="brouillon")
    params = request.query_params

    statut = (params.get("statut") or "").strip()
    if statut:
        qs = qs.filter(statut_qualite=statut)

    type_id = (params.get("type_document") or "").strip()
    if type_id.isdigit():
        qs = qs.filter(type_document_id=int(type_id))

    localite_id = (params.get("localite") or "").strip()
    if localite_id.isdigit():
        qs = qs.filter(localite_id=int(localite_id))

    date_debut, date_fin, _ = _parse_period(request)
    if date_debut:
        qs = qs.filter(date_creation__gte=date_debut)
    if date_fin:
        qs = qs.filter(date_creation__lte=date_fin)

    return qs


def _group_count(qs, *fields):
    """Agrégation COUNT groupée — order_by() vide requis pour SQL Server."""
    return qs.values(*fields).annotate(count=Count("id")).order_by()


def _filters_payload(request):
    date_debut, date_fin, periode = _parse_period(request)
    params = request.query_params
    return {
        "periode": periode,
        "statut": (params.get("statut") or "").strip() or None,
        "type_document": (params.get("type_document") or "").strip() or None,
        "localite": (params.get("localite") or "").strip() or None,
        "date_debut": date_debut.isoformat() if date_debut else None,
        "date_fin": date_fin.isoformat() if date_fin else None,
    }


def _build_subtree_getter():
    children_map = {}
    for node_id, parent_id in PlanGeographique.objects.values_list("id", "parent_id"):
        if parent_id:
            children_map.setdefault(parent_id, []).append(node_id)

    cache = {}

    def get_subtree(node_id):
        if node_id in cache:
            return cache[node_id]
        result = {node_id}
        stack = list(children_map.get(node_id, []))
        while stack:
            child_id = stack.pop()
            if child_id in result:
                continue
            result.add(child_id)
            stack.extend(children_map.get(child_id, []))
        cache[node_id] = result
        return result

    return get_subtree


def _geo_explorer_payload(request, qs):
    geo_parent = (request.query_params.get("geo_parent") or "").strip()
    get_subtree = _build_subtree_getter()

    localite_counts = {
        row["localite_id"]: row["count"]
        for row in _group_count(qs, "localite_id")
    }

    if geo_parent.isdigit():
        parent_id = int(geo_parent)
        try:
            parent_node = PlanGeographique.objects.select_related("niveau").get(pk=parent_id)
        except PlanGeographique.DoesNotExist:
            return {"niveau_label": "", "breadcrumb": [], "parent_id": None, "items": []}

        nodes = (
            PlanGeographique.objects.filter(parent_id=parent_id)
            .select_related("niveau")
            .order_by("libelle")
        )
        breadcrumb = [{"id": a.id, "libelle": a.libelle} for a in parent_node.get_ancetres()]
        breadcrumb.append({"id": parent_node.id, "libelle": parent_node.libelle})
        child_niveau = parent_node.get_niveau_enfant()
        niveau_label = child_niveau.libelle if child_niveau else parent_node.niveau.libelle
        parent_for_back = parent_node.parent_id
    else:
        nodes = (
            PlanGeographique.objects.filter(parent__isnull=True)
            .select_related("niveau")
            .order_by("libelle")
        )
        breadcrumb = []
        first = nodes.first()
        niveau_label = first.niveau.libelle if first else "Plan de classement"
        parent_for_back = None

    items = []
    for node in nodes:
        subtree = get_subtree(node.id)
        count = sum(localite_counts.get(lid, 0) for lid in subtree)
        has_children = PlanGeographique.objects.filter(parent_id=node.id).exists()
        items.append({
            "localite_id": node.id,
            "libelle": node.libelle,
            "code": node.code or "",
            "niveau": node.niveau.libelle,
            "count": count,
            "has_children": has_children,
        })

    items.sort(key=lambda x: (-x["count"], x["libelle"]))

    return {
        "niveau_label": niveau_label,
        "breadcrumb": breadcrumb,
        "parent_id": parent_for_back,
        "geo_parent": int(geo_parent) if geo_parent.isdigit() else None,
        "items": items,
    }


def _statuts_with_rates(total, counts_by_statut):
    return [
        {
            "statut": key,
            "label": label,
            "count": counts_by_statut.get(key, 0),
            "taux": round((counts_by_statut.get(key, 0) / total) * 100, 1) if total else 0,
        }
        for key, label in STATUT_LABELS.items()
    ]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_meta_view(request):
    """Métadonnées pour les filtres interactifs du dashboard."""
    types = list(
        TypeDocument.objects.order_by("libelle").values("id", "libelle", "code")[:100]
    )
    localites = list(
        PlanGeographique.objects.annotate(doc_count=Count("documents"))
        .filter(doc_count__gt=0)
        .order_by("-doc_count", "libelle")
        .values("id", "libelle", "code", "doc_count")[:50]
    )
    return Response({
        "statuts": [{"value": k, "label": v} for k, v in STATUT_LABELS.items()],
        "periodes": [
            {"value": "7", "label": "7 derniers jours"},
            {"value": "30", "label": "30 derniers jours"},
            {"value": "90", "label": "90 derniers jours"},
            {"value": "180", "label": "6 derniers mois"},
            {"value": "365", "label": "12 derniers mois"},
            {"value": "all", "label": "Toute la période"},
        ],
        "types_documents": types,
        "localites": localites,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_documents_view(request):
    """Statistiques documentaires avec filtres croisés."""
    qs = _document_queryset(request)
    total = qs.count()
    counts_by_statut = {
        row["statut_qualite"]: row["count"]
        for row in _group_count(qs, "statut_qualite")
    }
    docs_statut = _statuts_with_rates(total, counts_by_statut)

    docs_by_type = (
        _group_count(qs, "type_document_id", "type_document__libelle")
        .order_by("-count")[:10]
    )
    docs_type = [
        {
            "type_id": item["type_document_id"],
            "type": item["type_document__libelle"] or "Non défini",
            "count": item["count"],
        }
        for item in docs_by_type
    ]

    twelve_months_ago = timezone.now() - timedelta(days=365)
    monthly_raw = (
        qs.filter(date_creation__gte=twelve_months_ago)
        .annotate(mois=TruncMonth("date_creation"))
        .values("mois", "statut_qualite")
        .annotate(count=Count("id"))
        .order_by("mois", "statut_qualite")
    )
    evolution_map = {}
    for row in monthly_raw:
        key = row["mois"].strftime("%Y-%m")
        if key not in evolution_map:
            evolution_map[key] = {
                "mois": key,
                "en_attente": 0,
                "valide": 0,
                "rejete": 0,
                "total": 0,
            }
        statut = row["statut_qualite"]
        if statut not in STATUT_LABELS:
            continue
        evolution_map[key][statut] = row["count"]
        evolution_map[key]["total"] += row["count"]
    evolution_mensuelle = list(evolution_map.values())

    funnel_qc = [
        {"etape": label, "statut": key, "count": counts_by_statut.get(key, 0)}
        for key, label in STATUT_LABELS.items()
    ]

    top_createurs = list(
        qs.exclude(created_by__isnull=True)
        .values("created_by__username", "created_by__first_name", "created_by__last_name")
        .annotate(count=Count("id"))
        .order_by("-count", "created_by__username")[:8]
    )
    top_createurs_fmt = [
        {
            "utilisateur": (
                f"{r['created_by__first_name']} {r['created_by__last_name']}".strip()
                or r["created_by__username"]
            ),
            "count": r["count"],
        }
        for r in top_createurs
    ]

    top_validateurs = list(
        qs.exclude(valide_par__isnull=True)
        .values("valide_par__username", "valide_par__first_name", "valide_par__last_name")
        .annotate(count=Count("id"))
        .order_by("-count", "valide_par__username")[:8]
    )
    top_validateurs_fmt = [
        {
            "utilisateur": (
                f"{r['valide_par__first_name']} {r['valide_par__last_name']}".strip()
                or r["valide_par__username"]
            ),
            "count": r["count"],
        }
        for r in top_validateurs
    ]

    return Response({
        "filters_applied": _filters_payload(request),
        "kpis": {
            "total_documents": total,
            "par_statut": docs_statut,
        },
        "documents_par_statut": docs_statut,
        "documents_par_type": docs_type,
        "evolution_mensuelle": evolution_mensuelle,
        "funnel_qc": funnel_qc,
        "top_createurs": top_createurs_fmt,
        "top_validateurs": top_validateurs_fmt,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_documents_geo_view(request):
    """Exploration hiérarchique du plan de classement (drill-down)."""
    qs = _document_queryset(request)
    return Response(_geo_explorer_payload(request, qs))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_administration_view(request):
    """Statistiques d'administration (utilisateurs, accès, workflow QC, partage)."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({"detail": "Permission refusée."}, status=403)
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    date_debut, date_fin, periode = _parse_period(request)

    users_qs = User.objects.all()
    total_users = users_qs.count()
    active_users = users_qs.filter(is_active=True).count()
    inactive_users = users_qs.filter(is_active=False).count()
    new_users_30j = users_qs.filter(date_joined__gte=thirty_days_ago).count()
    connected_30j = users_qs.filter(last_login__gte=thirty_days_ago).count()
    never_connected = users_qs.filter(last_login__isnull=True).count()
    without_group = User.objects.annotate(nb_groups=Count("groups")).filter(nb_groups=0).count()

    groups = Group.objects.annotate(members=Count("user")).order_by("-members")
    groupes_data = [
        {"groupe": g.name, "membres": g.members, "id": g.id}
        for g in groups[:12]
    ]

    evolution_comptes = list(
        User.objects.filter(date_joined__gte=now - timedelta(days=365))
        .annotate(mois=TruncMonth("date_joined"))
        .values("mois")
        .annotate(count=Count("id"))
        .order_by("mois")
    )
    evolution_comptes_fmt = [
        {"mois": r["mois"].strftime("%Y-%m"), "count": r["count"]}
        for r in evolution_comptes
    ]

    notif_qs = NotificationEmailLog.objects.all()
    if date_debut:
        notif_qs = notif_qs.filter(created_at__gte=date_debut)

    notif_par_event = list(
        notif_qs.values("event_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    notif_events = [
        {
            "event": r["event_type"],
            "label": EVENT_LABELS.get(r["event_type"], r["event_type"]),
            "count": r["count"],
        }
        for r in notif_par_event
    ]

    notif_par_statut = list(
        notif_qs.values("statut")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    notif_statuts = [
        {
            "statut": r["statut"],
            "label": NOTIF_STATUT_LABELS.get(r["statut"], r["statut"]),
            "count": r["count"],
        }
        for r in notif_par_statut
    ]

    notif_daily = list(
        notif_qs.filter(created_at__gte=thirty_days_ago)
        .annotate(jour=TruncDate("created_at"))
        .values("jour")
        .annotate(count=Count("id"))
        .order_by("jour")
    )
    notif_evolution = [
        {"jour": r["jour"].strftime("%Y-%m-%d"), "count": r["count"]}
        for r in notif_daily
    ]

    liens_qs = LienTelechargement.objects.all()
    liens_actifs = liens_qs.filter(is_active=True, expires_at__gt=now).count()
    liens_expires = liens_qs.filter(Q(expires_at__lte=now) | Q(is_active=False)).count()
    liens_30j = liens_qs.filter(created_at__gte=thirty_days_ago).count()
    docs_partages = sum(
        len(link.document_ids or [])
        for link in liens_qs.filter(is_active=True, expires_at__gt=now)
    )

    couverture = []
    for profile in GroupProfile.objects.select_related("group").prefetch_related(
        "localites", "types_documents"
    )[:15]:
        couverture.append({
            "id": profile.group.id,
            "groupe": profile.group.name,
            "membres": profile.group.user_set.count(),
            "localites": profile.localites.count(),
            "types_documents": profile.types_documents.count(),
            "modules": len(profile.modules or []),
        })

    parametrage = {
        "types_documents": TypeDocument.objects.count(),
        "localites_plan": PlanGeographique.objects.count(),
        "groupes": Group.objects.count(),
        "utilisateurs_actifs": active_users,
    }

    taux_echec_notif = 0
    total_notif = notif_qs.count()
    if total_notif:
        failed = notif_qs.filter(statut=NotificationEmailLog.Statut.FAILED).count()
        taux_echec_notif = round((failed / total_notif) * 100, 1)

    return Response({
        "filters_applied": _filters_payload(request),
        "kpis": {
            "utilisateurs_total": total_users,
            "utilisateurs_actifs": active_users,
            "utilisateurs_inactifs": inactive_users,
            "nouveaux_comptes_30j": new_users_30j,
            "connexions_30j": connected_30j,
            "jamais_connectes": never_connected,
            "sans_groupe": without_group,
            "groupes_total": Group.objects.count(),
            "liens_actifs": liens_actifs,
            "liens_expires": liens_expires,
            "liens_crees_30j": liens_30j,
            "documents_partages": docs_partages,
            "notifications_total": total_notif,
            "taux_echec_notifications": taux_echec_notif,
        },
        "parametrage": parametrage,
        "utilisateurs_par_groupe": groupes_data,
        "evolution_comptes": evolution_comptes_fmt,
        "notifications_par_event": notif_events,
        "notifications_par_statut": notif_statuts,
        "notifications_evolution_30j": notif_evolution,
        "couverture_groupes": couverture,
        "liens_telechargement": {
            "actifs": liens_actifs,
            "expires": liens_expires,
            "crees_30j": liens_30j,
            "documents_partages": docs_partages,
        },
    })
