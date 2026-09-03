from django.db import models
from django.utils import timezone
from django.conf import settings


class StructureGeographique(models.Model):

    ordre = models.IntegerField(unique=True)
    code = models.CharField(max_length=50, unique=True)
    libelle = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="structures_geographiques_creees")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="structures_geographiques_modifiees")

    date_creation = models.DateTimeField(default=timezone.now)
    date_modification = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ordre}. {self.libelle}"

    class Meta:
        ordering = ['ordre']
        verbose_name = "Niveau de classement"
        verbose_name_plural = "Niveaux de classement"