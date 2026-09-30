from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Count, Min, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gestion_acces.models.group_profile import GroupProfile
from gestion_acces.models.lien_telechargement import LienTelechargement
from gestion_acces.models.notification import EvenementNotification, NotificationEmailLog
from gestion_acces.services.access_service import (
    filter_document_queryset,
    filter_type_document_queryset,
    get_allowed_plan_ids,
    get_user_accessible_leaf_localite_ids,
)
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


PERIODE_DAYS = {"7": 7, "30": 30, "90": 90, "180": 180, "365": 365}


def _parse_day(value):
    try:
        return parse_date((value or "").strip())
    except ValueError:
        return None


def _parse_period(request):
    """
    Retourne (date_debut, date_fin, periode_code).
    date_fin est exclusive ; date_debut None = depuis le premier document.
    """
    params = request.query_params
    periode = (params.get("periode") or "365").strip()
    now = timezone.now()

    if periode == "custom":
        debut = _parse_day(params.get("date_debut"))
        fin = _parse_day(params.get("date_fin"))
        if debut or fin:
            if debut and fin and debut > fin:
                debut, fin = fin, debut
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(datetime.combine(debut, time.min), tz) if debut else None
            end = (
                timezone.make_aware(datetime.combine(fin, time.min), tz) + timedelta(days=1)
                if fin
                else now
            )
            return start, end, "custom"
        periode = "365"

    days = PERIODE_DAYS.get(periode)
    if days is None:
        return None, now, "all"
    return now - timedelta(days=days), now, periode


def _filter_period(qs, date_debut, date_fin):
    if date_debut:
        qs = qs.filter(date_creation__gte=date_debut)
    if date_fin:
        qs = qs.filter(date_creation__lt=date_fin)
    return qs


def _document_base_queryset(request):
    """Documents du périmètre de l'utilisateur avec les filtres, hors période."""
    qs = filter_document_queryset(
        DocumentLocalite.objects.exclude(statut_qualite="brouillon"), request.user
    )
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

    return qs


def _document_queryset(request):
    date_debut, date_fin, _ = _parse_period(request)
    return _filter_period(_document_base_queryset(request), date_debut, date_fin)


def _granularite(jours):
    if jours <= 31:
        return "jour"
    if jours <= 183:
        return "semaine"
    return "mois"


def _bucket_start(day, granularite):
    if granularite == "semaine":
        return day - timedelta(days=day.weekday())
    if granularite == "mois":
        return day.replace(day=1)
    return day


def _next_bucket(day, granularite):
    if granularite == "jour":
        return day + timedelta(days=1)
    if granularite == "semaine":
        return day + timedelta(days=7)
    return (day.replace(day=28) + timedelta(days=4)).replace(day=1)


def _evolution_payload(qs, date_debut, date_fin):
    """Documents créés par jour, semaine ou mois selon la durée de la période, sans trou."""
    if date_debut is None:
        first = qs.aggregate(first=Min("date_creation"))["first"]
        if first is None:
            return {"granularite": "mois", "points": []}
        date_debut = first
    premier_jour = timezone.localtime(date_debut).date()
    dernier_jour = timezone.localtime(date_fin - timedelta(microseconds=1)).date()
    granularite = _granularite((dernier_jour - premier_jour).days + 1)

    trunc = TruncMonth("date_creation") if granularite == "mois" else TruncDate("date_creation")
    rows = qs.annotate(bucket=trunc).values("bucket", "statut_qualite").annotate(count=Count("id")).order_by()

    points = {}
    day = _bucket_start(premier_jour, granularite)
    while day <= dernier_jour:
        points[day] = {"periode": day.isoformat(), "en_attente": 0, "valide": 0, "rejete": 0, "total": 0}
        day = _next_bucket(day, granularite)

    for row in rows:
        bucket = row["bucket"]
        if bucket is None or row["statut_qualite"] not in STATUT_LABELS:
            continue
        if isinstance(bucket, datetime):
            bucket = timezone.localtime(bucket).date() if timezone.is_aware(bucket) else bucket.date()
        point = points.get(_bucket_start(bucket, granularite))
        if point is None:
            continue
        point[row["statut_qualite"]] += row["count"]
        point["total"] += row["count"]

    return {"granularite": granularite, "points": list(points.values())}


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


def _visible_plan_ids(user):
    """Branches du plan visibles : ancêtres, localités assignées et leurs descendants. None = tout."""
    allowed = get_allowed_plan_ids(user)
    if allowed is None:
        return None
    return allowed | (get_user_accessible_leaf_localite_ids(user) or set())


def _geo_explorer_payload(request, qs):
    geo_parent = (request.query_params.get("geo_parent") or "").strip()
    get_subtree = _build_subtree_getter()
    visible_ids = _visible_plan_ids(request.user)
    plan_qs = PlanGeographique.objects.all()
    if visible_ids is not None:
        plan_qs = plan_qs.filter(id__in=visible_ids)

    localite_counts = {
        row["localite_id"]: row["count"]
        for row in _group_count(qs, "localite_id")
    }

    if geo_parent.isdigit():
        parent_id = int(geo_parent)
        try:
            parent_node = plan_qs.select_related("niveau").get(pk=parent_id)
        except PlanGeographique.DoesNotExist:
            return {"niveau_label": "", "breadcrumb": [], "parent_id": None, "items": []}

        nodes = (
            plan_qs.filter(parent_id=parent_id)
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
            plan_qs.filter(parent__isnull=True)
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
        has_children = plan_qs.filter(parent_id=node.id).exists()
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
        filter_type_document_queryset(TypeDocument.objects.all(), request.user)
        .order_by("libelle")
        .values("id", "libelle", "code")[:100]
    )
    docs_qs = filter_document_queryset(
        DocumentLocalite.objects.exclude(statut_qualite="brouillon"), request.user
    )
    localites = [
        {
            "id": row["localite_id"],
            "libelle": row["localite__libelle"],
            "code": row["localite__code"],
            "doc_count": row["count"],
        }
        for row in _group_count(docs_qs, "localite_id", "localite__libelle", "localite__code")
        .order_by("-count", "localite__libelle")[:50]
    ]
    return Response({
        "statuts": [{"value": k, "label": v} for k, v in STATUT_LABELS.items()],
        "periodes": [
            {"value": "7", "label": "7 derniers jours"},
            {"value": "30", "label": "30 derniers jours"},
            {"value": "90", "label": "90 derniers jours"},
            {"value": "180", "label": "6 derniers mois"},
            {"value": "365", "label": "12 derniers mois"},
            {"value": "all", "label": "Toute la période"},
            {"value": "custom", "label": "Période personnalisée"},
        ],
        "types_documents": types,
        "localites": localites,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_documents_view(request):
    """Statistiques documentaires avec filtres croisés."""
    date_debut, date_fin, _ = _parse_period(request)
    qs = _filter_period(_document_base_queryset(request), date_debut, date_fin)
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
        "evolution": _evolution_payload(qs, date_debut, date_fin),
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
    user = request.user
    if not (user.is_superuser or user.has_perm("auth.view_user") or user.has_perm("auth.view_group")):
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
