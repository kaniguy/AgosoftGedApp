from django.db import models

from config.file_validation import (
    ALLOWED_IMAGE_FILE_VALIDATOR,
    UploadedFileValidator,
    validate_image_upload,
)


class Entreprise(models.Model):
    """
    Paramètres de l'organisation (singleton, id=1).
    Libellé et logo affichés dans l'application, comme la société dans Odoo.
    """

    libelle = models.CharField(max_length=50, default="AGOSOFT-GED")
    slogan = models.CharField(
        max_length=255,
        blank=True,
        default="Gestion Électronique de Documents",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    telephone = models.CharField(max_length=30, blank=True, default="")
    logo = models.FileField(
        upload_to="entreprise/", validators=[ALLOWED_IMAGE_FILE_VALIDATOR, UploadedFileValidator(kind="image", label="logo")],
        null=True,
        blank=True,
    )
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "entreprise"
        verbose_name_plural = "entreprises"

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.logo:
            validate_image_upload(self.logo, label="logo")  # content_type / mime / magic bytes
        super().save(*args, **kwargs)  # ALLOWED mime validated above

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def default_values(cls):
        return {
            "libelle": cls._meta.get_field("libelle").default,
            "slogan": cls._meta.get_field("slogan").default,
            "description": cls._meta.get_field("description").default,
            "email": cls._meta.get_field("email").default,
            "telephone": cls._meta.get_field("telephone").default,
        }

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults=cls.default_values(),
        )
        return obj

    @classmethod
    def reset_to_defaults(cls):
        obj = cls.get_solo()
        defaults = cls.default_values()
        obj.libelle = defaults["libelle"]
        obj.slogan = defaults["slogan"]
        obj.description = defaults["description"]
        obj.email = defaults["email"]
        obj.telephone = defaults["telephone"]
        if obj.logo:
            obj.logo.delete(save=False)
            obj.logo = None
        obj.save()  # ALLOWED — logo cleared, no upload
        return obj

    def __str__(self):
        return self.libelle or "Entreprise"
