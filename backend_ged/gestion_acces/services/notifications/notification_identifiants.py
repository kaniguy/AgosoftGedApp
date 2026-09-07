"""Notification d'envoi des identifiants à la création d'un compte."""

from django.core.exceptions import ObjectDoesNotExist

from gestion_acces.constants import APP_MODULES
from gestion_acces.models.notification import (
    CibleNotification,
    EvenementNotification,
    NotificationEmailLog,
    PreferenceNotification,
)
from gestion_acces.services.email_config_service import is_email_configured

from .commun import (
    default_html,
    frontend_base,
    log_skip,
    queue_and_send,
    render_for_recipient,
    user_display_name,
)

EVENT_TYPE = EvenementNotification.IDENTIFIANTS
DEFAULT_TARGET = CibleNotification.COMPTE
DEFAULT_ENABLED = True
DEFAULT_RESPECTER_PREFERENCES = False
MODULE_LABELS = {m["code"]: m["label"] for m in APP_MODULES}

DEFAULT_TEMPLATE = {
    "nom": "Envoi du mot de passe (création de compte)",
    "sujet": "[GED] Vos identifiants de connexion",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "Un compte a été créé pour vous sur la GED.\n\n"
        "Identifiant : {{username}}\n"
        "Mot de passe : {{password}}\n"
        "Connexion : {{login_url}}\n\n"
        "Groupes : {{groupes}}\n"
        "Modules : {{modules}}\n\n"
        "À la première connexion, vous pourrez modifier ce mot de passe (facultatif).\n"
        "Ne transmettez pas cet e-mail.\n\n— GED"
    ),
    "corps_html": default_html(
        "Vos identifiants GED",
        "<p>Bonjour <strong>{{recipient_name}}</strong>,</p>"
        "<p>Un compte a été créé pour vous sur la GED.</p>"
        "<p>Identifiant : <strong>{{username}}</strong><br/>"
        "Mot de passe : <strong>{{password}}</strong></p>"
        "<p>Groupes : {{groupes}}<br/>Modules : {{modules}}</p>"
        '<p><a href="{{login_url}}" style="display:inline-block;background:#7c3aed;'
        "color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;\">"
        "Se connecter</a></p>"
        "<p style='color:#64748b;font-size:13px;'>À la première connexion, vous pourrez "
        "modifier ce mot de passe (ce n’est pas obligatoire).</p>",
    ),
}


def _access_lines(user) -> tuple[str, str]:
    groups = list(user.groups.all())
    group_names = [g.name for g in groups] or ["Aucun groupe"]
    module_codes = []
    for group in groups:
        try:
            profile = group.ged_profile
        except ObjectDoesNotExist:
            profile = None
        for code in getattr(profile, "modules", None) or []:
            if code not in module_codes:
                module_codes.append(code)
    module_labels = [MODULE_LABELS.get(c, c) for c in module_codes] or [
        "Selon les groupes attribués"
    ]
    return ", ".join(group_names), ", ".join(module_labels)


def build_identifiants_context(user, password: str) -> dict:
    groupes_txt, modules_txt = _access_lines(user)
    return {
        "username": user.username,
        "password": password,
        "login_url": f"{frontend_base()}/auth/login",
        "groupes": groupes_txt,
        "modules": modules_txt,
        "recipient_name": user_display_name(user),
    }


def can_auto_send_identifiants() -> tuple[bool, str]:
    """SMTP + règle activée + modèle actif (indépendant du mot de passe saisi)."""
    from .registre import get_or_create_regle, get_or_create_template

    if not is_email_configured():
        return False, "smtp"
    regle = get_or_create_regle(EVENT_TYPE)
    if not regle.is_enabled:
        return False, "rule"
    template = regle.modele or get_or_create_template(EVENT_TYPE)
    if not template.is_active:
        return False, "template"
    return True, ""


def notifier_identifiants(user, password: str, actor=None) -> str:
    """
    Envoie l'e-mail d'identifiants de façon synchrone.
    Retourne « sent », « failed », « skipped » ou « disabled ».
    """
    from .registre import get_or_create_regle, get_or_create_template

    email = (user.email or "").strip()
    if not email:
        log_skip(EVENT_TYPE, user, "Adresse e-mail non renseignée.", actor=actor)
        return "skipped"

    regle = get_or_create_regle(EVENT_TYPE)
    if not regle.is_enabled:
        log_skip(EVENT_TYPE, user, "Règle d'envoi désactivée.", actor=actor)
        return "disabled"

    template = regle.modele or get_or_create_template(EVENT_TYPE)
    if not template.is_active:
        log_skip(EVENT_TYPE, user, "Modèle d'e-mail désactivé.", actor=actor)
        return "disabled"

    if regle.respecter_preferences:
        prefs = PreferenceNotification.get_for_user(user)
        if not prefs.accepte(EVENT_TYPE):
            log_skip(
                EVENT_TYPE,
                user,
                "Notification désactivée dans les préférences.",
                actor=actor,
            )
            return "skipped"

    context = build_identifiants_context(user, password)
    prepared = [(user, *render_for_recipient(template, context, user))]
    entries = queue_and_send(
        prepared,
        EVENT_TYPE,
        document=None,
        actor=actor,
        async_send=False,
    )
    if not entries:
        return "failed"
    entry = NotificationEmailLog.objects.get(pk=entries[0].pk)
    if entry.statut == NotificationEmailLog.Statut.SENT:
        return "sent"
    return "failed"
