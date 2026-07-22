"""Notification envoyée après correction et resoumission d'un document rejeté."""

from gestion_acces.models.notification import CibleNotification, EvenementNotification

from .commun import default_html, notify_document_event

EVENT_TYPE = EvenementNotification.RESOUMISSION
DEFAULT_TARGET = CibleNotification.CONTROLEURS
DEFAULT_TEMPLATE = {
    "nom": "Resoumission après rejet",
    "sujet": "[GED] Document corrigé à recontrôler — {{document_label}}",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "{{actor_name}} a corrigé et resoumis le document "
        "« {{document_label}} » ({{document_type}}) sur la localité "
        "{{localite}} le {{action_date}}.\n\n"
        "Merci de le recontrôler : {{document_url}}\n\n— GED"
    ),
    "corps_html": default_html(
        "Document corrigé à recontrôler",
        "<p>Bonjour {{recipient_name}},</p>"
        "<p><strong>{{actor_name}}</strong> a corrigé et resoumis le document "
        "« <strong>{{document_label}}</strong> » ({{document_type}}) sur la "
        "localité <strong>{{localite}}</strong> le {{action_date}}.</p>"
        '<p><a href="{{document_url}}" style="color:#7c3aed;">'
        "Ouvrir le contrôle qualité</a></p>",
    ),
}


def notifier_resoumission(document, actor=None, async_send=True):
    return notify_document_event(
        document,
        EVENT_TYPE,
        actor=actor,
        async_send=async_send,
    )
