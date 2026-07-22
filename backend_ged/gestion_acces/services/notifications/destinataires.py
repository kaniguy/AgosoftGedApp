"""Résolution des destinataires selon permissions et périmètres GED."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from gestion_acces.models.notification import CibleNotification, RegleNotification

QC_PERMISSION_CODENAMES = ("qc_valider", "qc_rejeter")


def scope_allows(user, localite_id, type_document_id) -> bool:
    from gestion_acces.services.access_service import (
        get_user_leaf_localite_ids,
        get_user_type_document_ids,
    )

    localite_ids = get_user_leaf_localite_ids(user)
    if localite_ids is not None and localite_id not in localite_ids:
        return False
    type_ids = get_user_type_document_ids(user)
    if type_ids is not None and type_document_id not in type_ids:
        return False
    return True


def qc_candidates_queryset():
    User = get_user_model()
    permission_filter = (
        Q(
            groups__permissions__codename__in=QC_PERMISSION_CODENAMES,
            groups__permissions__content_type__app_label="gestion_documentaire",
        )
        | Q(
            user_permissions__codename__in=QC_PERMISSION_CODENAMES,
            user_permissions__content_type__app_label="gestion_documentaire",
        )
        | Q(is_superuser=True)
    )
    return (
        User.objects.filter(is_active=True)
        .filter(permission_filter)
        .distinct()
        .prefetch_related(
            "groups__ged_profile__localites",
            "groups__ged_profile__types_documents",
        )
    )


def get_controleurs_for_document(localite_id, type_document_id):
    return [
        user
        for user in qc_candidates_queryset()
        if scope_allows(user, localite_id, type_document_id)
    ]


def resolve_recipients(
    regle: RegleNotification,
    document=None,
    actor=None,
):
    User = get_user_model()
    recipients = []

    if regle.recipient_target == CibleNotification.CREATEUR:
        if document is not None and document.created_by_id:
            creator = document.created_by
            if creator and creator.is_active:
                recipients = [creator]
    elif regle.recipient_target == CibleNotification.CONTROLEURS:
        if document is not None:
            recipients = get_controleurs_for_document(
                document.localite_id,
                document.type_document_id,
            )
    elif regle.recipient_target == CibleNotification.GROUPES:
        recipients = list(
            User.objects.filter(
                is_active=True,
                groups__in=regle.recipient_groups.all(),
            ).distinct()
        )
    elif regle.recipient_target == CibleNotification.UTILISATEURS:
        recipients = list(regle.recipient_users.filter(is_active=True))

    if regle.exclude_actor and actor is not None:
        recipients = [user for user in recipients if user.pk != actor.pk]

    seen = set()
    unique = []
    for user in recipients:
        if user.pk not in seen:
            seen.add(user.pk)
            unique.append(user)
    return unique
