"""Notification envoyée au créateur après validation du document."""

from gestion_acces.models.notification import CibleNotification, EvenementNotification

from .commun import default_html, notify_document_event

EVENT_TYPE = EvenementNotification.VALIDATION
DEFAULT_TARGET = CibleNotification.CREATEUR
DEFAULT_TEMPLATE = {
    "nom": "Validation du document",
    "sujet": "[GED] Document validé — {{document_label}}",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "Votre document « {{document_label}} » ({{document_type}}) a été "
        "validé par {{actor_name}} le {{action_date}}.\n\n"
        "Consulter : {{document_url}}\n\n— GED"
    ),
    "corps_html": default_html(
        "Document validé",
        "<p>Bonjour {{recipient_name}},</p>"
        "<p>Votre document « <strong>{{document_label}}</strong> » "
        "({{document_type}}) a été validé par "
        "<strong>{{actor_name}}</strong> le {{action_date}}.</p>"
        '<p><a href="{{document_url}}" style="color:#7c3aed;">'
        "Consulter le document</a></p>",
    ),
}


def notifier_validation(document, actor=None, async_send=True):
    return notify_document_event(
        document,
        EVENT_TYPE,
        actor=actor,
        async_send=async_send,
    )
