from django.conf import settings
from django.db import models

from config.file_validation import ALLOWED_DOCUMENT_FILE_VALIDATOR, UploadedFileValidator
from gestion_documentaire.services.document_version_storage import document_version_upload_path


class DocumentVersion(models.Model):
    """Historique d'une version archivée d'un document."""

    document = models.ForeignKey(
        "gestion_documentaire.DocumentLocalite",
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    fichier = models.FileField(
        upload_to=document_version_upload_path, validators=[ALLOWED_DOCUMENT_FILE_VALIDATOR, UploadedFileValidator(kind="document", label="document")],
        max_length=1024,
    )
    valeurs_snapshot = models.JSONField(default=list, blank=True)
    annotations = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_versions_creees",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    commentaire = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-date_creation", "-id"]
        verbose_name = "Version document"
        verbose_name_plural = "Versions document"

    def __str__(self):
        return f"Document #{self.document_id} — v{self.version_number}"
