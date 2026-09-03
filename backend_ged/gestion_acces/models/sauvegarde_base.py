from django.db import models


class SauvegardeBase(models.Model):
    """Permissions de sauvegarde / restauration (pas de table)."""

    class Meta:
        managed = False
        default_permissions = ("view",)
        permissions = (
            ("exporter_sauvegardebase", "Peut exporter la base de données"),
            ("restaurer_sauvegardebase", "Peut restaurer la base de données"),
            ("reinitialiser_sauvegardebase", "Peut réinitialiser la base de données"),
        )
        verbose_name = "base de données"
        verbose_name_plural = "bases de données"
