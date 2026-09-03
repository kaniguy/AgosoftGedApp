import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone


VALIDITY_HOURS_CHOICES = (
    (3, "3 heures"),
    (5, "5 heures"),
    (12, "12 heures"),
    (24, "24 heures"),
)

ALLOWED_VALIDITY_HOURS = {3, 5, 12, 24}


class LienTelechargement(models.Model):
    """Lien public temporaire pour télécharger un ou plusieurs documents."""

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    document_ids = models.JSONField(default=list)
    validity_hours = models.PositiveSmallIntegerField(choices=VALIDITY_HOURS_CHOICES)
    expires_at = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    # Sécurité : usage unique + mot de passe optionnel
    one_time = models.BooleanField(
        default=True,
        help_text="Si vrai, le lien est désactivé après le premier téléchargement réussi.",
    )
    password_hash = models.CharField(max_length=128, blank=True, default="")
    download_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="liens_telechargement_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Lien de téléchargement"
        verbose_name_plural = "Liens de téléchargement"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Lien {self.token} ({len(self.document_ids or [])} doc(s))"

    @property
    def document_count(self):
        return len(self.document_ids or [])

    @property
    def has_password(self):
        return bool(self.password_hash)

    def set_password(self, raw_password):
        if raw_password:
            self.password_hash = make_password(raw_password)
        else:
            self.password_hash = ""

    def check_password(self, raw_password):
        if not self.password_hash:
            return True
        return check_password(raw_password or "", self.password_hash)

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_usable(self):
        return self.is_active and not self.is_expired()

    def mark_downloaded(self):
        """Incrémente le compteur ; désactive si one_time."""
        self.download_count = (self.download_count or 0) + 1
        updates = ["download_count"]
        if self.one_time:
            self.is_active = False
            updates.append("is_active")
        self.save(update_fields=updates)
