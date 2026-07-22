from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from config.file_validation import (
    ALLOWED_IMAGE_FILE_VALIDATOR,
    UploadedFileValidator,
)


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    photo = models.FileField(
        upload_to="profile_photos/", validators=[ALLOWED_IMAGE_FILE_VALIDATOR, UploadedFileValidator(kind="image", label="photo")],
        null=True,
        blank=True,
    )
    signature = models.FileField(
        upload_to="profile_signatures/",
        validators=[ALLOWED_IMAGE_FILE_VALIDATOR, UploadedFileValidator(kind="image", label="signature")],
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "profil utilisateur"
        verbose_name_plural = "profils utilisateur"

    def __str__(self):
        return f"Profil de {self.user.username}"


# Signaux pour créer/sauvegarder automatiquement le profil utilisateur
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    profile, created = UserProfile.objects.get_or_create(user=instance)
    profile.save()  # ALLOWED — no file upload on User post_save
