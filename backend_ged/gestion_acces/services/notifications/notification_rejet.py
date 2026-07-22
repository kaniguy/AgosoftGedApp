"""Notification envoyée au créateur après rejet du document."""

from gestion_acces.models.notification import CibleNotification, EvenementNotification

from .commun import default_html, notify_document_event

EVENT_TYPE = EvenementNotification.REJET
DEFAULT_TARGET = CibleNotification.CREATEUR
DEFAULT_TEMPLATE = {
    "nom": "Rejet du document",
    "sujet": "[GED] Document rejeté — {{document_label}}",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "Votre document « {{document_label}} » ({{document_type}}) a été "
        "rejeté par {{actor_name}} le {{action_date}}.\n\n"
        "Motif : {{rejection_reason}}\n\n"
        "Corriger et resoumettre : {{document_url}}\n\n— GED"
    ),
    "corps_html": default_html(
        "Document rejeté",
        "<p>Bonjour {{recipient_name}},</p>"
        "<p>Votre document « <strong>{{document_label}}</strong> » "
        "({{document_type}}) a été rejeté par "
        "<strong>{{actor_name}}</strong> le {{action_date}}.</p>"
        '<p style="background:#fef2f2;border:1px solid #fecaca;'
        'border-radius:8px;padding:12px;"><strong>Motif :</strong> '
        "{{rejection_reason}}</p>"
        '<p><a href="{{document_url}}" style="color:#7c3aed;">'
        "Corriger et resoumettre</a></p>",
    ),
}


def notifier_rejet(document, actor=None, async_send=True):
    return notify_document_event(
        document,
        EVENT_TYPE,
        actor=actor,
        async_send=async_send,
    )
