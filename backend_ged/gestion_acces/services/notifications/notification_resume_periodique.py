"""Résumé périodique des documents en attente de contrôle qualité."""

from django.utils import timezone

from gestion_acces.models.notification import (
    CibleNotification,
    ConfigurationResumePeriodique,
    EvenementNotification,
)

from .commun import (
    default_html,
    frontend_base,
    log_skip,
    queue_and_send,
    render_for_recipient,
)
from .destinataires import qc_candidates_queryset, scope_allows
from .notification_pdf_resume import generer_pdf_resume, nom_fichier_pdf

EVENT_TYPE = EvenementNotification.RESUME_PERIODIQUE
DEFAULT_TARGET = CibleNotification.CONTROLEURS
DEFAULT_TEMPLATE = {
    "nom": "Résumé périodique des documents en attente",
    "sujet": "[GED] {{pending_count}} document(s) en attente de contrôle",
    "corps_texte": (
        "Bonjour {{recipient_name}},\n\n"
        "{{pending_count}} document(s) attendent votre contrôle qualité.\n\n"
        "La liste détaillée est jointe en PDF.\n"
        "Accéder au contrôle qualité : {{document_url}}\n\n— GED"
    ),
    "corps_html": default_html(
        "Documents en attente de contrôle",
        "<p>Bonjour {{recipient_name}},</p>"
        "<p><strong>{{pending_count}}</strong> document(s) attendent votre "
        "contrôle qualité.</p>"
        "<p>La liste détaillée est jointe en PDF.</p>"
        '<p><a href="{{document_url}}" style="color:#7c3aed;">'
        "Accéder au contrôle qualité</a></p>",
    ),
}


def _should_send_now(config, now_local, force):
    if force:
        return True, ""
    if not config.is_enabled:
        return False, "Résumé périodique désactivé."
    current_time = now_local.time().replace(tzinfo=None)
    if current_time < config.heure_envoi:
        return (
            False,
            "L'heure d'envoi configurée n'est pas encore atteinte "
            f"({config.heure_envoi.strftime('%H:%M')}).",
        )
    if (
        config.frequence
        == ConfigurationResumePeriodique.Frequence.HEBDOMADAIRE
        and now_local.weekday() != config.jour_semaine
    ):
        return False, "Ce n'est pas le jour d'envoi configuré."
    if config.dernier_envoi is not None:
        last_local = timezone.localtime(config.dernier_envoi)
        # Bloque uniquement si le créneau du jour a déjà été servi : un envoi
        # antérieur à l'heure programmée (ex. après reprogrammation à une
        # heure plus tardive) ne compte pas.
        if (
            last_local.date() == now_local.date()
            and last_local.time() >= config.heure_envoi
        ):
            return False, (
                "Résumé déjà envoyé aujourd'hui pour le créneau de "
                f"{config.heure_envoi.strftime('%H:%M')}."
            )
    return True, ""


def _build_digest_context(documents, now_local):
    return {
        "pending_count": len(documents),
        "pending_list": "",
        "pending_list_html": "",
        "action_date": now_local.strftime("%d/%m/%Y à %H:%M"),
        "document_url": f"{frontend_base()}/controle_qualite/en_attente",
        "document_label": "",
        "document_type": "",
        "localite": "",
        "actor_name": "GED",
        "rejection_reason": "",
    }


def envoyer_resume_periodique(force=False, async_send=False):
    from gestion_documentaire.models import DocumentLocalite

    from .registre import get_or_create_regle, get_or_create_template

    config = ConfigurationResumePeriodique.get_solo()
    result = {"envoyes": 0, "ignores": 0, "erreurs": 0, "detail": ""}
    now_local = timezone.localtime(timezone.now())
    can_send, detail = _should_send_now(config, now_local, force)
    if not can_send:
        result["detail"] = detail
        return result

    regle = get_or_create_regle(EVENT_TYPE)
    template = (
        config.modele
        or regle.modele
        or get_or_create_template(EVENT_TYPE)
    )
    pending_documents = list(
        DocumentLocalite.objects.filter(
            statut_qualite=DocumentLocalite.STATUT_EN_ATTENTE
        ).select_related(
            "type_document",
            "localite__niveau",
            "created_by",
        )
    )
    if not pending_documents:
        result["detail"] = "Aucun document en attente."
        return result

    prepared = []
    for user in qc_candidates_queryset():
        user_documents = [
            document
            for document in pending_documents
            if scope_allows(
                user,
                document.localite_id,
                document.type_document_id,
            )
        ]
        if len(user_documents) < max(int(config.min_documents or 1), 1):
            result["ignores"] += 1
            continue
        if not (user.email or "").strip():
            log_skip(EVENT_TYPE, user, "Adresse e-mail non renseignée.")
            result["ignores"] += 1
            continue
        context = _build_digest_context(user_documents, now_local)
        piece_jointe = (
            nom_fichier_pdf(now_local),
            generer_pdf_resume(user_documents, user, now_local),
            "application/pdf",
        )
        prepared.append(
            (
                user,
                *render_for_recipient(template, context, user),
                [piece_jointe],
            )
        )

    if prepared:
        queue_and_send(
            prepared,
            EVENT_TYPE,
            async_send=async_send,
        )
        result["envoyes"] = len(prepared)

    config.dernier_envoi = timezone.now()
    config.save(update_fields=["dernier_envoi"])
    result["detail"] = f"{len(prepared)} résumé(s) mis en file."
    return result
