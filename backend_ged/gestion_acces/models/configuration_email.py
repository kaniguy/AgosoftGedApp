from django.db import models


class ConfigurationEmail(models.Model):
    """
    Paramètres SMTP de l'application (singleton, id=1).
    Aucune donnée personnelle par défaut : à renseigner dans Gestion des accès.
    """

    email_backend = models.CharField(
        max_length=200,
        default="django.core.mail.backends.smtp.EmailBackend",
        blank=True,
        help_text="Backend Django (SMTP ou console).",
    )
    email_host = models.CharField(max_length=255, blank=True, default="")
    email_port = models.PositiveIntegerField(default=587)
    email_use_tls = models.BooleanField(default=True)
    email_use_ssl = models.BooleanField(default=False)
    email_host_user = models.EmailField(blank=True, default="")
    email_host_password = models.CharField(max_length=255, blank=True, default="")
    default_from_email = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Ex. GED <adresse@exemple.com>",
    )
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuration e-mail"
        verbose_name_plural = "configurations e-mail"

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.email_use_tls and self.email_use_ssl:
            self.email_use_ssl = False
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    def __str__(self):
        return f"E-mail SMTP ({self.email_host or 'non configuré'})"

    @classmethod
    def empty_defaults(cls):
        return {
            "email_backend": "django.core.mail.backends.smtp.EmailBackend",
            "email_host": "",
            "email_port": 587,
            "email_use_tls": True,
            "email_use_ssl": False,
            "email_host_user": "",
            "email_host_password": "",
            "default_from_email": "",
        }

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults=cls.empty_defaults())
        return obj

    @classmethod
    def reset_to_empty(cls):
        """Efface toute configuration personnelle / SMTP."""
        obj = cls.get_solo()
        for key, value in cls.empty_defaults().items():
            setattr(obj, key, value)
        obj.save()
        return obj
