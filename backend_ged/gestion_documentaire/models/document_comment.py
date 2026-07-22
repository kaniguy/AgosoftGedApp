from django.conf import settings
from django.db import models

from gestion_documentaire.models.document import DocumentLocalite


class DocumentComment(models.Model):
    """Commentaire textuel lié à un document (hors canvas PDF)."""

    document = models.ForeignKey(
        DocumentLocalite,
        on_delete=models.CASCADE,
        related_name="commentaires",
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_commentaires",
    )
    texte = models.TextField()
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date_creation"]
        verbose_name = "Commentaire document"
        verbose_name_plural = "Commentaires document"

    def __str__(self):
        preview = (self.texte or "")[:40]
        return f"Commentaire #{self.pk} — {preview}"
