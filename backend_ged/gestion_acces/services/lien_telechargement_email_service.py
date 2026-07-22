"""Envoi par e-mail des liens de téléchargement temporaires."""

from __future__ import annotations

import html
import logging
import re
import threading

from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.utils import timezone

logger = logging.getLogger(__name__)

MAX_RECIPIENTS = 20


def parse_recipient_emails(raw: str) -> list[str]:
    """
    Parse une ou plusieurs adresses séparées par ; ou ,.
    Retourne une liste dédupliquée (ordre conservé).
    """
    if not raw or not str(raw).strip():
        return []

    parts = re.split(r"[;,]+", str(raw))
    emails: list[str] = []
    seen: set[str] = set()
    invalid: list[str] = []

    for part in parts:
        email = part.strip()
        if not email:
            continue
        try:
            validate_email(email)
        except ValidationError:
            invalid.append(email)
            continue
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        emails.append(email)

    if invalid:
        raise ValueError(
            "Adresse(s) e-mail invalide(s) : " + ", ".join(invalid)
        )
    if len(emails) > MAX_RECIPIENTS:
        raise ValueError(f"Maximum {MAX_RECIPIENTS} destinataires par envoi.")
    return emails


def _sender_label(user) -> str:
    if not user:
        return "GED"
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.get_username()


def _email_context(link, *, sender_user=None) -> dict:
    from gestion_acces.serializers.lien_telechargement_serializer import LienTelechargementSerializer

    serializer = LienTelechargementSerializer(link)
    download_url = serializer.data.get("download_url") or ""
    doc_count = len(link.document_ids or [])
    expires_local = timezone.localtime(link.expires_at)
    expires_label = expires_local.strftime("%d/%m/%Y à %H:%M")
    sender = _sender_label(sender_user)
    validity_label = f"{link.validity_hours} heure{'s' if link.validity_hours > 1 else ''}"

    if doc_count > 1:
        doc_label = f"{doc_count} documents"
        doc_detail = "Les fichiers seront proposés en archive (ZIP/RAR)."
        doc_icon = "📦"
    else:
        doc_label = "1 document"
        doc_detail = "Le fichier sera téléchargeable directement."
        doc_icon = "📄"

    return {
        "download_url": download_url,
        "doc_count": doc_count,
        "doc_label": doc_label,
        "doc_detail": doc_detail,
        "doc_icon": doc_icon,
        "expires_label": expires_label,
        "validity_label": validity_label,
        "sender": sender,
    }


def _build_text_body(ctx: dict) -> str:
    return (
        f"Bonjour,\n\n"
        f"{ctx['sender']} vous a partagé un lien de téléchargement temporaire pour {ctx['doc_label']}.\n\n"
        f"Télécharger : {ctx['download_url']}\n\n"
        f"Validité : jusqu'au {ctx['expires_label']} ({ctx['validity_label']})\n"
        f"{ctx['doc_detail']}\n"
        f"Aucune connexion n'est requise pour télécharger.\n\n"
        f"— GED"
    )


def _build_html_body(ctx: dict) -> str:
    sender = html.escape(ctx["sender"])
    doc_label = html.escape(ctx["doc_label"])
    doc_detail = html.escape(ctx["doc_detail"])
    expires_label = html.escape(ctx["expires_label"])
    validity_label = html.escape(ctx["validity_label"])
    download_url = html.escape(ctx["download_url"], quote=True)
    doc_icon = ctx["doc_icon"]

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lien de téléchargement GED</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0891b2 0%,#0284c7 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#cffafe;">GED</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Lien de téléchargement
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                Bonjour,
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#475569;">
                <strong style="color:#0f172a;">{sender}</strong> vous a partagé un lien de téléchargement temporaire.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:28px;line-height:1;padding-right:14px;vertical-align:top;">{doc_icon}</td>
                        <td>
                          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a;">{doc_label}</p>
                          <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">{doc_detail}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#0891b2 0%,#0284c7 100%);">
                    <a href="{download_url}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Télécharger maintenant
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0e7490;">
                      Validité du lien
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.5;color:#155e75;">
                      Jusqu'au <strong>{expires_label}</strong> ({validity_label})
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b;">
                Aucune connexion n'est requise. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{download_url}" style="color:#0891b2;text-decoration:underline;">{download_url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Message automatique — Gestion Électronique de Documents
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_download_link_email(link, *, sender_user=None) -> tuple[str, str, str, str]:
    """Retourne (sujet, corps texte, corps HTML, url de téléchargement)."""
    ctx = _email_context(link, sender_user=sender_user)
    subject = f"GED — Lien de téléchargement ({ctx['doc_label']})"
    text_body = _build_text_body(ctx)
    html_body = _build_html_body(ctx)
    return subject, text_body, html_body, ctx["download_url"]


def send_download_link_email(link, recipients, *, sender_user=None) -> list[str]:
    """
    Envoie le lien à un ou plusieurs destinataires en un seul envoi SMTP.
    `recipients` : str (séparés par ; ou ,) ou liste d'adresses.
    """
    if isinstance(recipients, str):
        emails = parse_recipient_emails(recipients)
    else:
        emails = parse_recipient_emails(";".join(recipients or []))

    if not emails:
        raise ValueError("Adresse e-mail du destinataire requise.")

    subject, text_body, html_body, _ = build_download_link_email(link, sender_user=sender_user)
    from gestion_acces.services.email_config_service import (
        get_default_from_email,
        get_smtp_connection,
    )

    from_email = get_default_from_email() or "noreply@localhost"
    connection = get_smtp_connection(fail_silently=False)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=emails,
        connection=connection,
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)
    return emails


def queue_download_link_email(link_id: int, recipients: list[str], *, sender_user_id=None) -> None:
    """Envoie l'e-mail en arrière-plan pour ne pas bloquer la réponse HTTP."""

    def _run():
        try:
            from django.contrib.auth import get_user_model

            from gestion_acces.models.lien_telechargement import LienTelechargement

            link = LienTelechargement.objects.select_related("created_by").get(pk=link_id)
            sender = None
            if sender_user_id:
                User = get_user_model()
                sender = User.objects.filter(pk=sender_user_id).first()
            send_download_link_email(link, recipients, sender_user=sender)
        except Exception:
            logger.exception(
                "Échec envoi e-mail lien téléchargement id=%s destinataires=%s",
                link_id,
                recipients,
            )

    threading.Thread(target=_run, daemon=True, name=f"lien-email-{link_id}").start()
