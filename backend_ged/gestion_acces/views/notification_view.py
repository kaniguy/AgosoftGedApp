"""API de paramétrage des notifications e-mail du workflow QC."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gestion_acces.models.notification import (
    ConfigurationResumePeriodique,
    EvenementNotification,
    ModeleEmailNotification,
    NotificationEmailLog,
    PreferenceNotification,
    RegleNotification,
)
from gestion_acces.serializers.notification_serializer import (
    ConfigurationResumePeriodiqueSerializer,
    ModeleEmailNotificationSerializer,
    NotificationEmailLogSerializer,
    PreferenceNotificationSerializer,
    RegleNotificationSerializer,
)
from gestion_acces.services.notifications import (
    ensure_seed_data,
    render_template_string,
)
from gestion_acces.services.notifications.registre import reset_template_to_defaults

TEMPLATE_VARIABLES = [
    {
        "nom": "{{recipient_name}}",
        "description": "Prénom et nom du destinataire de l'e-mail (personnalisation).",
        "events": [],
    },
    {
        "nom": "{{document_label}}",
        "description": (
            "Intitulé complet du document : type documentaire et localité "
            "(ex. « Facture — Casier A »)."
        ),
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{document_type}}",
        "description": "Libellé du type documentaire seul (ex. « Facture fournisseur »).",
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{localite}}",
        "description": "Libellé de la localité (casier) où le document est rangé.",
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{actor_name}}",
        "description": (
            "Nom de l'utilisateur qui a déclenché l'action "
            "(soumission, validation ou rejet)."
        ),
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{rejection_reason}}",
        "description": (
            "Motif saisi lors du rejet. Vide ou « Non précisé » si absent "
            "(événement rejet uniquement)."
        ),
        "events": ["rejet"],
    },
    {
        "nom": "{{action_date}}",
        "description": "Date et heure de l'action, au format français (jj/mm/aaaa à hh:mm).",
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{document_url}}",
        "description": (
            "Lien direct vers la page de contrôle ou de consultation du document "
            "dans l'application."
        ),
        "events": ["soumission", "validation", "rejet", "resoumission"],
    },
    {
        "nom": "{{pending_count}}",
        "description": (
            "Nombre de documents en attente dans le périmètre du destinataire "
            "(résumé périodique uniquement)."
        ),
        "events": ["resume_periodique"],
    },
    {
        "nom": "{{pending_list}}",
        "description": (
            "Liste textuelle des documents en attente, une ligne par document "
            "(résumé périodique uniquement). Le détail complet est en pièce jointe PDF."
        ),
        "events": ["resume_periodique"],
    },
    {
        "nom": "{{username}}",
        "description": "Identifiant de connexion du compte créé.",
        "events": ["identifiants"],
    },
    {
        "nom": "{{password}}",
        "description": "Mot de passe généré (uniquement si aucun mot de passe n'a été saisi à la création).",
        "events": ["identifiants"],
    },
    {
        "nom": "{{login_url}}",
        "description": "Lien vers la page de connexion de l'application.",
        "events": ["identifiants"],
    },
    {
        "nom": "{{groupes}}",
        "description": "Groupes attribués au compte, séparés par des virgules.",
        "events": ["identifiants"],
    },
    {
        "nom": "{{modules}}",
        "description": "Modules d'accès issus des groupes du compte.",
        "events": ["identifiants"],
    },
]

_SAMPLE_CONTEXT = {
    "document_label": "Facture fournisseur — Abidjan Plateau",
    "document_type": "Facture fournisseur",
    "localite": "Abidjan Plateau",
    "actor_name": "Awa Koné",
    "recipient_name": "Jean Kouassi",
    "rejection_reason": "Pages 2 et 3 illisibles, merci de rescanner.",
    "action_date": "18/07/2026 à 14:30",
    "document_url": "http://localhost:3000/controle_qualite/validation/12/345",
    "pending_count": "4",
    "pending_list": "- Facture fournisseur — Abidjan Plateau (depuis le 15/07/2026)\n- Bordereau — Yopougon (depuis le 16/07/2026)",
    "username": "jkouassi",
    "password": "ExemPle12",
    "login_url": "http://localhost:3001/auth/login",
    "groupes": "Contrôle qualité, Consultation",
    "modules": "Gestion documentaire, Contrôle qualité",
}


def _can_view(user):
    return user.is_superuser or user.has_perm("gestion_acces.view_reglenotification")


def _can_change(user):
    return user.is_superuser or user.has_perm("gestion_acces.change_reglenotification")


def _can_view_log(user):
    return user.is_superuser or user.has_perm("gestion_acces.view_notificationemaillog")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications_config_view(request):
    """Configuration complète : règles, modèles, résumé périodique et variables."""
    if not _can_view(request.user) and not _can_change(request.user):
        return Response(
            {"detail": "Vous n'avez pas la permission de consulter les notifications."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ensure_seed_data()
    regles = sorted(
        RegleNotification.objects.prefetch_related(
            "recipient_groups", "recipient_users"
        ),
        key=lambda regle: EvenementNotification.sort_key(regle.event_type),
    )
    modeles = sorted(
        ModeleEmailNotification.objects.all(),
        key=lambda modele: EvenementNotification.sort_key(modele.code),
    )
    resume = ConfigurationResumePeriodique.get_solo()
    return Response(
        {
            "regles": RegleNotificationSerializer(regles, many=True).data,
            "modeles": ModeleEmailNotificationSerializer(modeles, many=True).data,
            "resume": ConfigurationResumePeriodiqueSerializer(resume).data,
            "variables": TEMPLATE_VARIABLES,
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def regle_notification_update_view(request, event_type):
    if not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    if event_type not in EvenementNotification.values:
        return Response({"detail": "Événement inconnu."}, status=status.HTTP_404_NOT_FOUND)
    ensure_seed_data()
    regle = RegleNotification.objects.get(event_type=event_type)
    serializer = RegleNotificationSerializer(regle, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def modele_email_update_view(request, code):
    if not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    ensure_seed_data()
    try:
        modele = ModeleEmailNotification.objects.get(code=code)
    except ModeleEmailNotification.DoesNotExist:
        return Response({"detail": "Modèle introuvable."}, status=status.HTTP_404_NOT_FOUND)
    serializer = ModeleEmailNotificationSerializer(modele, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(modifie_par=request.user)
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def modele_email_reset_view(request, code):
    """Réinitialise un modèle d'e-mail aux valeurs par défaut."""
    if not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    if code not in EvenementNotification.values:
        return Response({"detail": "Modèle introuvable."}, status=status.HTTP_404_NOT_FOUND)
    ensure_seed_data()
    try:
        modele = reset_template_to_defaults(code)
    except ModeleEmailNotification.DoesNotExist:
        return Response({"detail": "Modèle introuvable."}, status=status.HTTP_404_NOT_FOUND)
    modele.modifie_par = request.user
    modele.save(update_fields=["modifie_par"])
    return Response(ModeleEmailNotificationSerializer(modele).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def modele_email_preview_view(request):
    """Prévisualisation d'un modèle avec des données d'exemple."""
    if not _can_view(request.user) and not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    sujet = request.data.get("sujet", "")
    corps_texte = request.data.get("corps_texte", "")
    corps_html = request.data.get("corps_html", "")
    return Response(
        {
            "sujet": render_template_string(sujet, _SAMPLE_CONTEXT),
            "corps_texte": render_template_string(corps_texte, _SAMPLE_CONTEXT),
            "corps_html": render_template_string(corps_html, _SAMPLE_CONTEXT, escape_html=True),
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def configuration_resume_view(request):
    if request.method == "GET":
        if not _can_view(request.user) and not _can_change(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            ConfigurationResumePeriodiqueSerializer(
                ConfigurationResumePeriodique.get_solo()
            ).data
        )

    if not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    config = ConfigurationResumePeriodique.get_solo()
    serializer = ConfigurationResumePeriodiqueSerializer(config, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def envoyer_resume_test_view(request):
    """Déclenche immédiatement le résumé périodique (test manuel)."""
    if not _can_change(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
    from gestion_acces.services.notifications.notification_resume_periodique import (
        envoyer_resume_periodique,
    )

    result = envoyer_resume_periodique(force=True, async_send=True)
    return Response(result)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def preferences_notification_view(request):
    """Préférences de notification de l'utilisateur connecté."""
    prefs = PreferenceNotification.get_for_user(request.user)
    if request.method == "GET":
        return Response(PreferenceNotificationSerializer(prefs).data)

    serializer = PreferenceNotificationSerializer(prefs, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def journal_notifications_view(request):
    """Journal des notifications avec filtres et pagination."""
    if not _can_view_log(request.user) and not _can_view(request.user):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)

    qs = NotificationEmailLog.objects.select_related(
        "recipient_user", "triggered_by"
    ).order_by("-created_at")

    event_type = (request.query_params.get("event_type") or "").strip()
    if event_type:
        qs = qs.filter(event_type=event_type)
    statut = (request.query_params.get("statut") or "").strip()
    if statut:
        qs = qs.filter(statut=statut)
    recherche = (request.query_params.get("q") or "").strip()
    if recherche:
        from django.db.models import Q

        qs = qs.filter(
            Q(recipient_email__icontains=recherche)
            | Q(document_label__icontains=recherche)
            | Q(sujet__icontains=recherche)
        )

    total = qs.count()
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
        limit = min(max(int(request.query_params.get("limit", 25)), 1), 100)
    except (TypeError, ValueError):
        offset, limit = 0, 25

    rows = qs[offset : offset + limit]
    return Response(
        {
            "results": NotificationEmailLogSerializer(rows, many=True).data,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < total,
        }
    )
