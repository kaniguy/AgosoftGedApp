"""Aiguillage d'un événement QC vers son module de notification dédié."""

from gestion_acces.models.notification import EvenementNotification

from .notification_rejet import notifier_rejet
from .notification_resoumission import notifier_resoumission
from .notification_soumission import notifier_soumission
from .notification_validation import notifier_validation

HANDLERS = {
    EvenementNotification.SOUMISSION: notifier_soumission,
    EvenementNotification.RESOUMISSION: notifier_resoumission,
    EvenementNotification.VALIDATION: notifier_validation,
    EvenementNotification.REJET: notifier_rejet,
}


def notifier_evenement_qc(
    document,
    event_type,
    actor=None,
    async_send=True,
):
    try:
        handler = HANDLERS[event_type]
    except KeyError as exc:
        raise ValueError(
            f"Événement QC non pris en charge : {event_type}"
        ) from exc
    return handler(
        document,
        actor=actor,
        async_send=async_send,
    )
