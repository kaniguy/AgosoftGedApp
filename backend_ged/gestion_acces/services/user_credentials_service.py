"""Provisionnement du mot de passe à la création d'un utilisateur."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from gestion_acces.password_policy import generate_ged_password
from gestion_acces.services.email_config_service import is_email_configured
from gestion_acces.services.notifications.notification_identifiants import (
    can_auto_send_identifiants,
    notifier_identifiants,
)

logger = logging.getLogger(__name__)


@dataclass
class CredentialResult:
    status: str
    detail: str
    generated_password: str | None = None


def provision_new_user_password(user, provided_password: str | None) -> CredentialResult:
    """
    Définit le mot de passe à la création :
    - fourni → on l'enregistre, aucun e-mail (même si le SMTP est configuré) ;
    - absent + SMTP + règle identifiants + e-mail → génération puis envoi ;
    - sinon → mot de passe non utilisable (l'admin le posera plus tard).
    """
    provided = (provided_password or "").strip()
    if provided:
        user.set_password(provided)
        return CredentialResult(
            status="manual",
            detail="Mot de passe enregistré. Aucun e-mail n'a été envoyé.",
        )

    email = (user.email or "").strip()
    can_send, reason = can_auto_send_identifiants()
    if can_send and email:
        generated = generate_ged_password()
        user.set_password(generated)
        return CredentialResult(
            status="pending_email",
            detail="Mot de passe généré, envoi de l'e-mail…",
            generated_password=generated,
        )

    user.set_unusable_password()
    if not email:
        detail = (
            "Aucun e-mail sur le compte : impossible d'envoyer un mot de passe généré. "
            "Ajoutez une adresse e-mail ou saisissez un mot de passe."
        )
    elif reason == "smtp" or not is_email_configured():
        detail = (
            "SMTP non configuré : aucun mot de passe n'a été défini. "
            "Saisissez-en un ou configurez le SMTP pour un envoi automatique."
        )
    elif reason == "rule":
        detail = (
            "L'envoi des identifiants est désactivé (Notifications → Règles d'envoi) : "
            "aucun mot de passe n'a été défini. Saisissez-en un ou activez la règle."
        )
    elif reason == "template":
        detail = (
            "Le modèle d'e-mail des identifiants est désactivé : "
            "aucun mot de passe n'a été défini. Saisissez-en un ou réactivez le modèle."
        )
    else:
        detail = "Aucun mot de passe n'a été défini."
    return CredentialResult(status="unset", detail=detail)


def finalize_new_user_credentials(user, result: CredentialResult, actor=None) -> CredentialResult:
    """Envoie l'e-mail après sauvegarde des groupes. Met à jour le statut."""
    if result.status != "pending_email" or not result.generated_password:
        return result
    try:
        status = notifier_identifiants(user, result.generated_password, actor=actor)
    except Exception:
        logger.exception("Envoi des identifiants impossible pour %s", user.username)
        status = "failed"

    if status == "sent":
        return CredentialResult(
            status="emailed",
            detail=f"Un e-mail contenant les identifiants a été envoyé à {user.email}.",
        )
    if status in ("skipped", "disabled"):
        return CredentialResult(
            status="email_failed",
            detail=(
                "Le mot de passe a été généré mais l'e-mail n'a pas été envoyé "
                "(règle, modèle ou préférence). Copiez-le et transmettez-le à l'utilisateur."
            ),
            generated_password=result.generated_password,
        )
    return CredentialResult(
        status="email_failed",
        detail=(
            "Le compte a un mot de passe généré mais l'e-mail n'a pas pu partir. "
            "Copiez-le et transmettez-le à l'utilisateur."
        ),
        generated_password=result.generated_password,
    )


def mark_password_prompt(user, enabled: bool) -> None:
    from gestion_acces.models.user_profile import UserProfile

    profile, _ = UserProfile.objects.get_or_create(user=user)
    if profile.suggest_password_change != enabled:
        profile.suggest_password_change = enabled
        profile.save(update_fields=["suggest_password_change"])
