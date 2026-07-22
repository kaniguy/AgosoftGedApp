"""Point d'entrée historique vers le système de notifications."""

from gestion_acces.services.notifications import (
    ensure_seed_data,
    envoyer_resume_periodique,
    get_controleurs_for_document,
    get_or_create_regle,
    get_or_create_template,
    notifier_evenement_qc,
    notifier_rejet,
    notifier_resoumission,
    notifier_soumission,
    notifier_validation,
    render_template_string,
    resolve_recipients,
)

__all__ = [
    "ensure_seed_data",
    "envoyer_resume_periodique",
    "get_controleurs_for_document",
    "get_or_create_regle",
    "get_or_create_template",
    "notifier_evenement_qc",
    "notifier_rejet",
    "notifier_resoumission",
    "notifier_soumission",
    "notifier_validation",
    "render_template_string",
    "resolve_recipients",
]
