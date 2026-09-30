"""Registre des types de notifications et initialisation de leur paramétrage."""

from gestion_acces.models.notification import (
    ConfigurationResumePeriodique,
    EvenementNotification,
    ModeleEmailNotification,
    RegleNotification,
)

from . import (
    notification_identifiants,
    notification_rejet,
    notification_resoumission,
    notification_resume_periodique,
    notification_soumission,
    notification_validation,
)

TYPE_MODULES = {
    notification_soumission.EVENT_TYPE: notification_soumission,
    notification_resoumission.EVENT_TYPE: notification_resoumission,
    notification_validation.EVENT_TYPE: notification_validation,
    notification_rejet.EVENT_TYPE: notification_rejet,
    notification_identifiants.EVENT_TYPE: notification_identifiants,
    notification_resume_periodique.EVENT_TYPE: notification_resume_periodique,
}


def get_type_module(event_type):
    try:
        return TYPE_MODULES[event_type]
    except KeyError as exc:
        raise ValueError(f"Type de notification inconnu : {event_type}") from exc


def get_or_create_template(event_type) -> ModeleEmailNotification:
    module = get_type_module(event_type)
    defaults = module.DEFAULT_TEMPLATE
    template, _ = ModeleEmailNotification.objects.get_or_create(
        code=event_type,
        defaults={
            "nom": defaults["nom"],
            "sujet": defaults["sujet"],
            "corps_texte": defaults["corps_texte"],
            "corps_html": defaults["corps_html"],
        },
    )
    return template


def get_or_create_regle(event_type) -> RegleNotification:
    module = get_type_module(event_type)
    regle, created = RegleNotification.objects.get_or_create(
        event_type=event_type,
        defaults={
            "is_enabled": getattr(module, "DEFAULT_ENABLED", False),
            "recipient_target": module.DEFAULT_TARGET,
        },
    )
    if created or not regle.modele_id:
        regle.modele = get_or_create_template(event_type)
        regle.save(update_fields=["modele"])
    return regle


def ensure_seed_data():
    for event_type in EvenementNotification.values:
        get_or_create_regle(event_type)
    ConfigurationResumePeriodique.get_solo()


def reset_template_to_defaults(event_type) -> ModeleEmailNotification:
    """Restaure sujet et corps aux valeurs d'usine du type de notification."""
    module = get_type_module(event_type)
    defaults = module.DEFAULT_TEMPLATE
    template = ModeleEmailNotification.objects.get(code=event_type)
    template.nom = defaults["nom"]
    template.sujet = defaults["sujet"]
    template.corps_texte = defaults["corps_texte"]
    template.corps_html = defaults["corps_html"]
    template.save(
        update_fields=["nom", "sujet", "corps_texte", "corps_html", "date_modification"]
    )
    return template
