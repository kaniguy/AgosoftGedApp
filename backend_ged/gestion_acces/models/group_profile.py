from django.db import models
from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver


class GroupProfile(models.Model):
    """Extension d'un groupe Django : modules et localités (dernier niveau) autorisés."""

    group = models.OneToOneField(
        Group, on_delete=models.CASCADE, related_name="ged_profile"
    )
    modules = models.JSONField(
        default=list,
        blank=True,
        help_text="Codes des modules accessibles (ex: gestion_documentaire)",
    )
    localites = models.ManyToManyField(
        "parametrage.PlanGeographique",
        blank=True,
        related_name="groupes_acces",
        help_text="Localités du dernier niveau attribuées au groupe",
    )
    types_documents = models.ManyToManyField(
        "parametrage.TypeDocument",
        blank=True,
        related_name="groupes_acces",
        help_text="Types de documents accessibles via ce groupe (vide = tous)",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Si désactivé, le groupe n'accorde plus de droits (les membres sont conservés).",
    )

    def __str__(self):
        return f"Profil accès — {self.group.name}"


@receiver(post_save, sender=Group)
def create_group_profile(sender, instance, created, **kwargs):
    """Crée automatiquement le profil d'accès lors de la création d'un groupe."""
    if created:
        GroupProfile.objects.get_or_create(group=instance)
