"""Briques partagées : rendu, journalisation et envoi SMTP."""

from __future__ import annotations

import html
import logging
import re
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import close_old_connections
from django.utils import timezone

from gestion_acces.models.notification import (
    ModeleEmailNotification,
    NotificationEmailLog,
)

logger = logging.getLogger(__name__)
PLACEHOLDER_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

HTML_WRAPPER = """<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#334155;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#7c3aed;padding:20px 28px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ede9fe;">GED</p>
      <h1 style="margin:4px 0 0;font-size:19px;color:#ffffff;">{titre}</h1>
    </div>
    <div style="padding:28px;font-size:14px;line-height:1.65;">{contenu}</div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Message automatique — Gestion Électronique de Documents</p>
    </div>
  </div>
</body>
</html>"""


def default_html(titre: str, contenu: str) -> str:
    return HTML_WRAPPER.replace("{titre}", titre).replace("{contenu}", contenu)


def render_template_string(
    template: str,
    context: dict,
    escape_html: bool = False,
) -> str:
    def _replace(match):
        value = context.get(match.group(1), "")
        value = "" if value is None else str(value)
        return html.escape(value) if escape_html else value

    return PLACEHOLDER_RE.sub(_replace, template or "")


def user_display_name(user) -> str:
    if not user:
        return "—"
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.get_username()


def frontend_base() -> str:
    return getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")


def build_document_context(document, actor=None) -> dict:
    type_libelle = document.type_document.libelle if document.type_document_id else ""
    localite_libelle = document.localite.libelle if document.localite_id else ""
    return {
        "document_label": f"{type_libelle} — {localite_libelle}".strip(" —"),
        "document_type": type_libelle,
        "localite": localite_libelle,
        "actor_name": user_display_name(actor),
        "rejection_reason": document.motif_rejet or "Non précisé",
        "action_date": timezone.localtime(timezone.now()).strftime(
            "%d/%m/%Y à %H:%M"
        ),
        "document_url": (
            f"{frontend_base()}/controle_qualite/validation/"
            f"{document.localite_id}/{document.pk}"
        ),
    }


def render_for_recipient(
    template: ModeleEmailNotification,
    context: dict,
    recipient,
) -> tuple[str, str, str]:
    ctx = {**context, "recipient_name": user_display_name(recipient)}
    sujet = render_template_string(template.sujet, ctx)
    corps_texte = render_template_string(template.corps_texte, ctx)
    corps_html = ""
    if template.corps_html:
        raw_keys = {"pending_list_html", "login_url"}
        corps_html = PLACEHOLDER_RE.sub(
            lambda match: (
                str(ctx.get(match.group(1), ""))
                if match.group(1) in raw_keys
                else html.escape(str(ctx.get(match.group(1), "") or ""))
            ),
            template.corps_html,
        )
    return sujet, corps_texte, corps_html


def log_skip(event_type, recipient, reason, document=None, actor=None):
    return NotificationEmailLog.objects.create(
        event_type=event_type,
        document=document,
        document_label=str(document) if document is not None else "",
        template_code=event_type,
        recipient_user=recipient,
        recipient_email=getattr(recipient, "email", "") or "",
        statut=NotificationEmailLog.Statut.SKIPPED,
        skip_reason=reason,
        triggered_by=actor,
    )


# Envois répartis sur plusieurs connexions SMTP au-delà de ce seuil.
_TAILLE_LOT_PAR_CONNEXION = 25
_MAX_CONNEXIONS_PARALLELES = 4


def _marquer_echec(entries, message_erreur):
    for entry in entries:
        entry.statut = NotificationEmailLog.Statut.FAILED
        entry.error_message = message_erreur
        entry.attempt_count += 1
        entry.save(update_fields=["statut", "error_message", "attempt_count"])


def _envoyer_lot(entries: list, from_email: str):
    """Envoie un lot d'e-mails en réutilisant une seule connexion SMTP."""
    from gestion_acces.services.email_config_service import get_smtp_connection

    close_old_connections()
    try:
        connection = get_smtp_connection(fail_silently=False)
        connection.open()
    except Exception as exc:
        logger.exception("Ouverture de la connexion SMTP impossible")
        _marquer_echec(entries, str(exc))
        return

    try:
        for entry in entries:
            try:
                message = EmailMultiAlternatives(
                    subject=entry.sujet,
                    body=getattr(entry, "_corps_texte", ""),
                    from_email=from_email,
                    to=[entry.recipient_email],
                    connection=connection,
                )
                html_body = getattr(entry, "_corps_html", "")
                if html_body:
                    message.attach_alternative(html_body, "text/html")
                for filename, content, mimetype in getattr(
                    entry, "_pieces_jointes", []
                ):
                    message.attach(filename, content, mimetype)
                try:
                    message.send(fail_silently=False)
                except Exception:
                    # Le serveur a pu couper la connexion : on la rouvre
                    # et on retente une fois avant de déclarer l'échec.
                    connection.close()
                    connection.open()
                    message.send(fail_silently=False)
                entry.statut = NotificationEmailLog.Statut.SENT
                entry.sent_at = timezone.now()
                entry.error_message = ""
            except Exception as exc:
                logger.exception("Échec notification e-mail id=%s", entry.pk)
                entry.statut = NotificationEmailLog.Statut.FAILED
                entry.error_message = str(exc)
            entry.attempt_count += 1
            entry.save(
                update_fields=[
                    "statut",
                    "sent_at",
                    "error_message",
                    "attempt_count",
                ]
            )
    finally:
        try:
            connection.close()
        except Exception:
            pass


def _send_prepared_rows(entries: list):
    from gestion_acces.services.email_config_service import (
        get_default_from_email,
        is_email_configured,
    )

    entries = [
        entry
        for entry in entries
        if entry.statut == NotificationEmailLog.Statut.QUEUED
    ]
    if not entries:
        return

    if not is_email_configured():
        _marquer_echec(
            entries,
            "Configuration SMTP-mail incomplète "
            "(Gestion des accès → Configuration SMTP-mail).",
        )
        return

    from_email = get_default_from_email()

    nb_lots = min(
        _MAX_CONNEXIONS_PARALLELES,
        -(-len(entries) // _TAILLE_LOT_PAR_CONNEXION),
    )
    if nb_lots <= 1:
        _envoyer_lot(entries, from_email)
        return

    # Répartition en lots envoyés en parallèle, chacun sur sa connexion
    # (smtplib n'est pas thread-safe, une connexion ne se partage pas).
    lots = [entries[i::nb_lots] for i in range(nb_lots)]
    threads = [
        threading.Thread(
            target=_envoyer_lot,
            args=(lot, from_email),
            daemon=True,
            name=f"notif-smtp-{index}",
        )
        for index, lot in enumerate(lots)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


def queue_and_send(
    prepared: list,
    event_type,
    document=None,
    actor=None,
    async_send=True,
):
    """Journalise puis envoie les tuples.

    Format accepté : (user, sujet, texte, html[, pièces_jointes]).
    Chaque pièce jointe est un tuple (nom, contenu binaire, type MIME).
    """
    if document is None:
        document_label = ""
    else:
        try:
            document_label = str(document)
        except Exception:
            document_label = f"Document #{document.pk}"

    entries = []
    bodies = {}
    for donnees in prepared:
        recipient, sujet, corps_texte, corps_html = donnees[:4]
        pieces_jointes = donnees[4] if len(donnees) > 4 else []
        entry = NotificationEmailLog.objects.create(
            event_type=event_type,
            document=document,
            document_label=document_label,
            template_code=event_type,
            recipient_user=recipient,
            recipient_email=recipient.email,
            sujet=sujet[:255],
            statut=NotificationEmailLog.Statut.QUEUED,
            triggered_by=actor,
        )
        entries.append(entry)
        bodies[entry.pk] = (corps_texte, corps_html, pieces_jointes)

    if not entries:
        return []

    log_ids = [entry.pk for entry in entries]

    def _run():
        close_old_connections()
        rows = list(NotificationEmailLog.objects.filter(pk__in=log_ids))
        for row in rows:
            (
                row._corps_texte,
                row._corps_html,
                row._pieces_jointes,
            ) = bodies.get(row.pk, ("", "", []))
        _send_prepared_rows(rows)

    if async_send:
        threading.Thread(
            target=_run,
            daemon=True,
            name=f"notif-{event_type}",
        ).start()
    else:
        _run()
    return entries


def notify_document_event(
    document,
    event_type,
    actor=None,
    async_send=True,
):
    """Pipeline générique commun aux notifications documentaires."""
    from .destinataires import resolve_recipients
    from .registre import get_or_create_regle, get_or_create_template

    try:
        regle = get_or_create_regle(event_type)
        if not regle.is_enabled:
            return []

        template = regle.modele or get_or_create_template(event_type)
        if not template.is_active:
            log_skip(
                event_type,
                None,
                "Modèle d'e-mail désactivé.",
                document,
                actor,
            )
            return []

        recipients = resolve_recipients(
            regle,
            document=document,
            actor=actor,
        )
        if not recipients:
            log_skip(
                event_type,
                None,
                "Aucun destinataire éligible.",
                document,
                actor,
            )
            return []

        context = build_document_context(document, actor=actor)
        prepared = []
        for recipient in recipients:
            if not (recipient.email or "").strip():
                log_skip(
                    event_type,
                    recipient,
                    "Adresse e-mail non renseignée.",
                    document,
                    actor,
                )
                continue
            prepared.append(
                (
                    recipient,
                    *render_for_recipient(template, context, recipient),
                )
            )

        return queue_and_send(
            prepared,
            event_type,
            document=document,
            actor=actor,
            async_send=async_send,
        )
    except Exception:
        logger.exception(
            "Erreur lors de la notification %s pour le document %s",
            event_type,
            getattr(document, "pk", None),
        )
        return []
