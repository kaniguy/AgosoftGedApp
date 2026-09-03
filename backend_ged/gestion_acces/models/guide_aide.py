import os
import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify

from config.file_validation import (
    ALLOWED_DOCUMENT_FILE_VALIDATOR,
    DOCUMENT_EXTENSIONS_NO_DOT,
    UploadedFileValidator,
)
from gestion_acces.constants import APP_MODULES

MODULE_GENERAL = "general"

GUIDE_AIDE_MODULE_CODES = (MODULE_GENERAL,) + tuple(
    m["code"] for m in APP_MODULES if m["code"] not in {"aide_video", "a_propos"}
)


def guide_aide_module_choices():
    labels = {MODULE_GENERAL: "Général (premiers pas)"}
    labels.update({m["code"]: m["label"] for m in APP_MODULES})
    return [(code, labels.get(code, code)) for code in GUIDE_AIDE_MODULE_CODES]


def aide_video_upload_path(instance, filename):
    """Conservé pour la migration 0021 (champ video retiré en 0022)."""
    ext = os.path.splitext(filename or "video")[1].lower() or ".mp4"
    unique = uuid.uuid4().hex[:8]
    base = slugify(os.path.splitext(filename or "video")[0])[:40] or "video"
    pk = getattr(instance, "pk", None) or "nouveau"
    return f"aide_video/{pk}_{base}_{unique}{ext}"


def aide_document_upload_path(instance, filename):
    ext = os.path.splitext(filename or "document")[1].lower() or ".pdf"
    if ext.lstrip(".") not in DOCUMENT_EXTENSIONS_NO_DOT:
        ext = ".pdf"
    guide_id = getattr(instance, "guide_id", None) or "nouveau"
    unique = uuid.uuid4().hex[:8]
    base = slugify(os.path.splitext(filename or "document")[0])[:40] or "document"
    return f"aide_video/docs/{guide_id}_{base}_{unique}{ext}"


class GuideAide(models.Model):
    """Tutoriel d'aide : vidéo YouTube + documents joints + guide écrit."""

    module_code = models.CharField(max_length=50, choices=guide_aide_module_choices())
    titre = models.CharField(max_length=180)
    description = models.CharField(max_length=400, blank=True, default="")
    youtube_url = models.URLField(blank=True, default="", max_length=500)
    guide = models.TextField(
        blank=True,
        default="",
        help_text="Texte du guide. Une étape par ligne.",
    )
    ordre = models.PositiveSmallIntegerField(default=0)
    actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guides_aide_modifies",
    )

    class Meta:
        ordering = ["ordre", "titre", "id"]
        verbose_name = "guide d'aide"
        verbose_name_plural = "guides d'aide"

    def __str__(self):
        return f"{self.get_module_code_display()} — {self.titre}"


class GuideAideDocument(models.Model):
    """Document (PDF / image) rattaché à un guide d'aide."""

    guide = models.ForeignKey(
        GuideAide,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    fichier = models.FileField(
        upload_to=aide_document_upload_path,
        validators=[
            ALLOWED_DOCUMENT_FILE_VALIDATOR,
            UploadedFileValidator(kind="document", label="document"),
        ],
        max_length=1024,
    )
    nom_original = models.CharField(max_length=255, blank=True, default="")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "document de guide d'aide"
        verbose_name_plural = "documents de guide d'aide"
        default_permissions = ()

    def __str__(self):
        return self.nom_original or os.path.basename(self.fichier.name)
