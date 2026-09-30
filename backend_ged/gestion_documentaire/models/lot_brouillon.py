from django.conf import settings
from django.db import models

from config.file_validation import (
    ALLOWED_GED_DOCUMENT_FILE_VALIDATOR,
    UploadedFileValidator,
)
from gestion_documentaire.services.lot_brouillon_storage import lot_brouillon_item_upload_path
from gestion_documentaire.services.encrypted_storage import encrypted_document_storage
from parametrage.models.champs_document import TypeDocument
from parametrage.models.plan_geographique import PlanGeographique


class LotBrouillonRattachement(models.Model):
    """Lot de documents en cours de saisie avant soumission au contrôle qualité."""

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lots_brouillon_rattachement",
        help_text="Dernier utilisateur ayant modifié ce brouillon.",
    )
    localite = models.ForeignKey(
        PlanGeographique,
        on_delete=models.CASCADE,
        related_name="lots_brouillon_rattachement",
    )
    type_document = models.ForeignKey(
        TypeDocument,
        on_delete=models.PROTECT,
        related_name="lots_brouillon_rattachement",
    )
    index_actif = models.PositiveIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_modification"]
        verbose_name = "Lot brouillon rattachement"
        verbose_name_plural = "Lots brouillon rattachement"
        constraints = [
            models.UniqueConstraint(
                fields=["localite"],
                name="uniq_lot_brouillon_localite",
            )
        ]

    def __str__(self):
        return f"Lot brouillon #{self.pk} — {self.localite}"


class ItemLotBrouillonRattachement(models.Model):
    """Document d'un lot brouillon (fichier + index saisis, non encore soumis)."""

    lot = models.ForeignKey(
        LotBrouillonRattachement,
        on_delete=models.CASCADE,
        related_name="items",
    )
    identifiant_client = models.CharField(max_length=64)
    ordre = models.PositiveIntegerField(default=0)
    nom_fichier = models.CharField(max_length=255, default="document.pdf")
    fichier = models.FileField(
        upload_to=lot_brouillon_item_upload_path,
        storage=encrypted_document_storage,
        validators=[ALLOWED_GED_DOCUMENT_FILE_VALIDATOR, UploadedFileValidator(kind="ged", label="document")],
        max_length=1024,
    )
    field_values = models.JSONField(default=dict, blank=True)
    zone_overrides = models.JSONField(default=dict, blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["ordre", "id"]
        verbose_name = "Item lot brouillon"
        verbose_name_plural = "Items lot brouillon"
        constraints = [
            models.UniqueConstraint(
                fields=["lot", "identifiant_client"],
                name="uniq_item_lot_client_id",
            )
        ]

    def __str__(self):
        return f"{self.nom_fichier} (lot #{self.lot_id})"
