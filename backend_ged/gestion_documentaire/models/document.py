from django.conf import settings
from django.db import models

from config.file_validation import (
    ALLOWED_DOCUMENT_FILE_VALIDATOR,
    UploadedFileValidator,
)
from gestion_documentaire.services.document_storage import document_upload_path
from gestion_documentaire.services.encrypted_storage import encrypted_document_storage
from parametrage.models.champs_document import ReponseDocument, TypeDocument
from parametrage.models.plan_geographique import PlanGeographique


class DocumentLocalite(models.Model):
    """Document (PDF / image) rattaché à une localité du plan de classement."""

    STATUT_BROUILLON = "brouillon"
    STATUT_EN_ATTENTE = "en_attente"
    STATUT_VALIDE = "valide"
    STATUT_REJETE = "rejete"
    STATUT_QUALITE_CHOICES = [
        (STATUT_BROUILLON, "Brouillon"),
        (STATUT_EN_ATTENTE, "En attente de validation"),
        (STATUT_VALIDE, "Validé"),
        (STATUT_REJETE, "Rejeté"),
    ]

    localite = models.ForeignKey(
        PlanGeographique,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    type_document = models.ForeignKey(
        TypeDocument,
        on_delete=models.PROTECT,
        related_name="documents_localite",
    )
    fichier = models.FileField(
        upload_to=document_upload_path,
        storage=encrypted_document_storage,
        validators=[ALLOWED_DOCUMENT_FILE_VALIDATOR, UploadedFileValidator(kind="document", label="document")],
        max_length=1024,
    )
    reponse = models.OneToOneField(
        ReponseDocument,
        on_delete=models.CASCADE,
        related_name="document_localite",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents_crees",
    )
    statut_qualite = models.CharField(
        max_length=20,
        choices=STATUT_QUALITE_CHOICES,
        default=STATUT_BROUILLON,
    )
    valide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents_valides",
    )
    valide_le = models.DateTimeField(null=True, blank=True)
    rejete_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents_rejetes",
    )
    rejete_le = models.DateTimeField(null=True, blank=True)
    motif_rejet = models.TextField(blank=True, default="")
    version_courante = models.PositiveIntegerField(default=1)
    annotations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Document localité"
        verbose_name_plural = "Documents localité"
        permissions = [
            ("qc_soumettre", "Peut soumettre au contrôle qualité"),
            ("qc_valider", "Peut valider (contrôle qualité)"),
            ("qc_rejeter", "Peut rejeter (contrôle qualité)"),
            ("qc_menu_en_attente", "Peut voir le menu docs en attente (QC)"),
            ("qc_menu_brouillon", "Peut voir le menu docs brouillon (QC)"),
            ("qc_menu_rejete", "Peut voir le menu docs rejetés (QC)"),
            ("qc_menu_valide", "Peut voir le menu docs validés (QC)"),
            ("annoter_document", "Peut annoter un document (surlignage, cadre, texte, stylo)"),
            ("tamponner_document", "Peut apposer des tampons sur un document"),
            ("signer_document", "Peut signer un document"),
            ("commenter_document", "Peut ajouter des commentaires sur un document"),
        ]

    def __str__(self):
        return f"{self.type_document} — {self.localite}"
