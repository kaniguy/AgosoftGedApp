from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models

from config.file_validation import (
    ALLOWED_IMAGE_FILE_VALIDATOR,
    UploadedFileValidator,
)


class UserSignature(models.Model):
    """Signature électronique rattachée à un compte (plusieurs par utilisateur)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="signatures",
    )
    image = models.FileField(
        upload_to="user_signatures/",
        validators=[
            ALLOWED_IMAGE_FILE_VALIDATOR,
            UploadedFileValidator(kind="image", label="signature"),
        ],
    )
    label = models.CharField(max_length=120, blank=True, default="")
    is_default = models.BooleanField(default=False)
    # Hash du mot de passe de protection (jamais stocké en clair)
    password_hash = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "signature utilisateur"
        verbose_name_plural = "signatures utilisateur"
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        name = self.label or f"Signature #{self.pk}"
        return f"{name} ({self.user.username})"

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
