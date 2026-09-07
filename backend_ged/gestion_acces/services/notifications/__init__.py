"""API publique du système de notifications."""

from .aiguillage import notifier_evenement_qc
from .commun import render_template_string
from .destinataires import get_controleurs_for_document, resolve_recipients
from .registre import (
    ensure_seed_data,
    get_or_create_regle,
    get_or_create_template,
)
from .notification_identifiants import notifier_identifiants
from .notification_rejet import notifier_rejet
from .notification_resoumission import notifier_resoumission
from .notification_resume_periodique import envoyer_resume_periodique
from .notification_soumission import notifier_soumission
from .notification_validation import notifier_validation

__all__ = [
    "ensure_seed_data",
    "envoyer_resume_periodique",
    "get_controleurs_for_document",
    "get_or_create_regle",
    "get_or_create_template",
    "notifier_evenement_qc",
    "notifier_identifiants",
    "notifier_rejet",
    "notifier_resoumission",
    "notifier_soumission",
    "notifier_validation",
    "render_template_string",
    "resolve_recipients",
]
