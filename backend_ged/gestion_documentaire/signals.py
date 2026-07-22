import logging

from django.db.models.signals import pre_delete, pre_save, post_save
from django.dispatch import receiver

from gestion_documentaire.models import (
    DocumentLocalite,
    DocumentVersion,
    ItemLotBrouillonRattachement,
    LotBrouillonRattachement,
)
from gestion_documentaire.services.document_storage import (
    delete_document_file,
    relocate_documents_for_plan_node,
)
from gestion_documentaire.services.lot_brouillon_storage import (
    delete_lot_brouillon_item_file,
    delete_lot_brouillon_lot_storage,
)
from parametrage.models.plan_geographique import PlanGeographique

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender=ItemLotBrouillonRattachement)
def _delete_lot_brouillon_item_file_before_remove(sender, instance, **kwargs):
    """Supprime le fichier physique d'un item brouillon."""
    try:
        delete_lot_brouillon_item_file(instance)
    except Exception:
        logger.exception(
            "Échec de la suppression du fichier brouillon (item #%s, lot #%s).",
            instance.pk,
            instance.lot_id,
        )
        raise


@receiver(pre_delete, sender=LotBrouillonRattachement)
def _delete_lot_brouillon_lot_storage_before_remove(sender, instance, **kwargs):
    """Supprime le dossier lot-{id} et nettoie le dossier utilisateur si vide."""
    try:
        delete_lot_brouillon_lot_storage(instance)
    except Exception:
        logger.exception(
            "Échec de la suppression du stockage brouillon (lot #%s).",
            instance.pk,
        )
        raise


@receiver(pre_delete, sender=DocumentVersion)
def _delete_document_version_file_before_remove(sender, instance, **kwargs):
    try:
        if instance.fichier:
            instance.fichier.delete(save=False)
    except Exception:
        logger.exception(
            "Échec de la suppression du fichier version #%s (document #%s).",
            instance.pk,
            instance.document_id,
        )
        raise


@receiver(pre_delete, sender=DocumentLocalite)
def _delete_document_file_before_remove(sender, instance, **kwargs):
    """Supprime le fichier physique lors de la suppression du document."""
    try:
        delete_document_file(instance)
    except Exception:
        logger.exception(
            "Échec de la suppression du fichier pour le document #%s.",
            instance.pk,
        )
        raise


@receiver(pre_save, sender=PlanGeographique)
def _capture_plan_libelle_before_save(sender, instance, **kwargs):
    """Mémorise l'ancien libellé pour détecter un renommage."""
    if not instance.pk:
        instance._previous_libelle = None
        return
    instance._previous_libelle = (
        PlanGeographique.objects.filter(pk=instance.pk)
        .values_list("libelle", flat=True)
        .first()
    )


@receiver(post_save, sender=PlanGeographique)
def _relocate_documents_after_libelle_change(sender, instance, **kwargs):
    """Renomme les dossiers physiques quand un libellé du plan change."""
    previous = getattr(instance, "_previous_libelle", None)
    if previous is None or previous == instance.libelle:
        return

    try:
        moved = relocate_documents_for_plan_node(instance)
        if moved:
            logger.info(
                "Libellé plan #%s modifié : %s document(s) déplacé(s).",
                instance.pk,
                moved,
            )
    except Exception:
        logger.exception(
            "Échec du déplacement des documents après modification du plan #%s.",
            instance.pk,
        )
        raise
