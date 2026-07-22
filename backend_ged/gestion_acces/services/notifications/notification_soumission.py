"""Notification envoyée lors d'une première soumission au contrôle qualité."""

from gestion_acces.models.notification import CibleNotification, EvenementNotification

from .commun import default_html, notify_document_event

EVENT_TYPE = EvenementNotification.SOUMISSION
DEFAULT_TARGET = CibleNotification.CONTROLEURS
DEFAULT_TEMPLATE = {
    "nom": "Soumission au contrôle qualité",
    "sujet": "[GED] Document à contrôler — {{document_label}}",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "{{actor_name}} a soumis le document « {{document_label}} » "
        "({{document_type}}) sur la localité {{localite}} le {{action_date}}.\n\n"
        "Merci de le contrôler : {{document_url}}\n\n— GED"
    ),
    "corps_html": default_html(
        "Document à contrôler",
        "<p>Bonjour {{recipient_name}},</p>"
        "<p><strong>{{actor_name}}</strong> a soumis le document "
        "« <strong>{{document_label}}</strong> » ({{document_type}}) sur la "
        "localité <strong>{{localite}}</strong> le {{action_date}}.</p>"
        '<p><a href="{{document_url}}" style="color:#7c3aed;">'
        "Ouvrir le contrôle qualité</a></p>",
    ),
}


def notifier_soumission(document, actor=None, async_send=True):
    return notify_document_event(
        document,
        EVENT_TYPE,
        actor=actor,
        async_send=async_send,
    )
