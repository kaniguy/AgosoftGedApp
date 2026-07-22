from django.db import models
from django.utils import timezone

from config.file_validation import (
    ALLOWED_DOCUMENT_FILE_VALIDATOR,
    UploadedFileValidator,
)
from parametrage.capture_storage import capture_modele_upload_path


# Modèle qui représente le formulaire/document créé par l'utilisateur
class TypeDocument(models.Model):
    code = models.CharField(max_length=50, unique=True)
    libelle = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Document de référence pour définir les zones de capture (style Dokmee Capture)
    fichier_modele = models.FileField(
        upload_to=capture_modele_upload_path, validators=[ALLOWED_DOCUMENT_FILE_VALIDATOR, UploadedFileValidator(kind="document", label="modèle")],
        blank=True,
        null=True,
        help_text="PDF ou image servant de modèle pour l'encadrement des champs.",
    )
    modele_page_count = models.PositiveSmallIntegerField(
        default=0,
        help_text="Nombre de pages du document modèle (mis à jour à l'upload).",
    )

    date_creation = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "type de document"
        verbose_name_plural = "types de documents"

    def __str__(self):
        return self.libelle



# Les champs dynamiques du document
class ChampsDocument(models.Model):

    TYPE_CHAMP = [
        ('texte', 'Texte court'),
        ('texte_long', 'Texte long'),
        ('nombre', 'Nombre'),
        ('date', 'Date'),
        ('datetime', 'Date et heure'),
        ('choix', 'Choix multiple'),
        ('select', 'Liste déroulante'),
        ('qr', 'Code QR'),
        ('code_barre', 'Code barre'),
    ]

    type_document = models.ForeignKey(
        TypeDocument,
        on_delete=models.CASCADE,
        related_name="champs"
    )

    libelle_champ = models.CharField(max_length=100)

    type_champ = models.CharField(
        max_length=50,
        choices=TYPE_CHAMP
    )

    obligatoire = models.BooleanField(default=False)

    ordre = models.IntegerField(default=1)

    # Zone de capture normalisée (0.0 à 1.0) relative à la page du modèle
    capture_page = models.PositiveSmallIntegerField(
        default=0,
        help_text="Index de page (0 = première page) où se trouve la zone.",
    )
    zone_x = models.FloatField(
        null=True,
        blank=True,
        help_text="Position X normalisée du coin supérieur gauche de la zone.",
    )
    zone_y = models.FloatField(
        null=True,
        blank=True,
        help_text="Position Y normalisée du coin supérieur gauche de la zone.",
    )
    zone_width = models.FloatField(
        null=True,
        blank=True,
        help_text="Largeur normalisée de la zone de capture.",
    )
    zone_height = models.FloatField(
        null=True,
        blank=True,
        help_text="Hauteur normalisée de la zone de capture.",
    )

    date_creation = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['ordre']
        verbose_name = "champ document"
        verbose_name_plural = "champs documents"

        constraints = [
            models.UniqueConstraint(
                fields=['type_document', 'ordre'],
                name='unique_ordre_champ_document'
            )
        ]

    def __str__(self):
        return self.libelle_champ

    @property
    def has_capture_zone(self) -> bool:
        """Indique si une zone de capture complète est configurée pour ce champ."""
        return (
            self.zone_x is not None
            and self.zone_y is not None
            and self.zone_width is not None
            and self.zone_height is not None
            and self.zone_width > 0
            and self.zone_height > 0
        )



# Options pour les champs select / choix multiple
class OptionChamp(models.Model):

    champ = models.ForeignKey(
        ChampsDocument,
        on_delete=models.CASCADE,
        related_name="options"
    )

    valeur = models.CharField(max_length=255)

    class Meta:
        verbose_name = "option de champ"
        verbose_name_plural = "options de champ"

    def __str__(self):
        return self.valeur



# Une réponse d'un utilisateur sur un document
class ReponseDocument(models.Model):

    type_document = models.ForeignKey(
        TypeDocument,
        on_delete=models.CASCADE,
        related_name="reponses"
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        verbose_name = "réponse document"
        verbose_name_plural = "réponses document"

    def __str__(self):
        return f"Réponse {self.type_document}"



# Valeurs saisies dans les champs
class ValeurChamp(models.Model):

    reponse = models.ForeignKey(
        ReponseDocument,
        on_delete=models.CASCADE,
        related_name="valeurs"
    )

    champ = models.ForeignKey(
        ChampsDocument,
        on_delete=models.CASCADE
    )

    valeur = models.TextField(blank=True)

    class Meta:
        verbose_name = "valeur de champ"
        verbose_name_plural = "valeurs de champ"

    def __str__(self):
        return f"{self.champ.libelle_champ} : {self.valeur}"