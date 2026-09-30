"""Notifications e-mail paramétrables du workflow documentaire (QC)."""

from django.conf import settings
from django.db import models


class EvenementNotification(models.TextChoices):
    SOUMISSION = "soumission", "Soumission au contrôle qualité"
    VALIDATION = "validation", "Validation du document"
    REJET = "rejet", "Rejet du document"
    RESOUMISSION = "resoumission", "Resoumission après rejet"
    IDENTIFIANTS = "identifiants", "Envoi du mot de passe (création de compte)"
    RESUME_PERIODIQUE = "resume_periodique", "Résumé périodique des documents en attente"

    @classmethod
    def workflow_codes(cls):
        """Ordre d'affichage aligné sur le parcours QC, puis identifiants."""
        return [
            cls.SOUMISSION,
            cls.VALIDATION,
            cls.REJET,
            cls.RESOUMISSION,
            cls.IDENTIFIANTS,
            cls.RESUME_PERIODIQUE,
        ]

    @classmethod
    def sort_key(cls, code):
        order = {value: index for index, value in enumerate(cls.workflow_codes())}
        return order.get(code, len(order))


class CibleNotification(models.TextChoices):
    CREATEUR = "createur", "Créateur du document"
    CONTROLEURS = "controleurs", "Contrôleurs éligibles (permissions + périmètre)"
    GROUPES = "groupes", "Groupes personnalisés"
    UTILISATEURS = "utilisateurs", "Utilisateurs personnalisés"
    COMPTE = "compte", "Le compte concerné"


class ModeleEmailNotification(models.Model):
    """Modèle d'e-mail éditable (sujet + corps texte / HTML, avec variables {{...}})."""

    code = models.CharField(max_length=50, unique=True)
    nom = models.CharField(max_length=150)
    sujet = models.CharField(max_length=255)
    corps_texte = models.TextField()
    corps_html = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    date_modification = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="modeles_email_modifies",
    )

    class Meta:
        verbose_name = "modèle d'e-mail de notification"
        verbose_name_plural = "modèles d'e-mail de notification"
        ordering = ["code"]

    def __str__(self):
        return f"{self.nom} ({self.code})"


class RegleNotification(models.Model):
    """Règle d'envoi immédiat pour un événement du workflow."""

    event_type = models.CharField(
        max_length=32,
        choices=EvenementNotification.choices,
        unique=True,
    )
    is_enabled = models.BooleanField(default=True)
    recipient_target = models.CharField(
        max_length=32,
        choices=CibleNotification.choices,
        default=CibleNotification.CREATEUR,
    )
    recipient_groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="regles_notification",
    )
    recipient_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="regles_notification",
    )
    exclude_actor = models.BooleanField(
        default=True,
        help_text="Ne pas notifier l'utilisateur qui déclenche l'action.",
    )
    modele = models.ForeignKey(
        ModeleEmailNotification,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="regles",
    )
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "règle de notification"
        verbose_name_plural = "règles de notification"
        ordering = ["event_type"]

    def __str__(self):
        return f"Règle {self.get_event_type_display()}"


class ConfigurationResumePeriodique(models.Model):
    """Paramètres du résumé périodique des documents en attente (singleton, id=1)."""

    class Frequence(models.TextChoices):
        QUOTIDIEN = "daily", "Quotidien"
        HEBDOMADAIRE = "weekly", "Hebdomadaire"

    JOURS_SEMAINE = [
        (0, "Lundi"),
        (1, "Mardi"),
        (2, "Mercredi"),
        (3, "Jeudi"),
        (4, "Vendredi"),
        (5, "Samedi"),
        (6, "Dimanche"),
    ]

    is_enabled = models.BooleanField(default=False)
    frequence = models.CharField(
        max_length=10,
        choices=Frequence.choices,
        default=Frequence.QUOTIDIEN,
    )
    heure_envoi = models.TimeField(default="08:00")
    jour_semaine = models.PositiveSmallIntegerField(
        choices=JOURS_SEMAINE,
        default=0,
        help_text="Jour d'envoi lorsque la fréquence est hebdomadaire.",
    )
    min_documents = models.PositiveIntegerField(
        default=1,
        help_text="Nombre minimum de documents en attente pour déclencher l'envoi.",
    )
    modele = models.ForeignKey(
        ModeleEmailNotification,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="configurations_resume",
    )
    dernier_envoi = models.DateTimeField(null=True, blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuration du résumé périodique"
        verbose_name_plural = "configurations du résumé périodique"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Résumé périodique ({'activé' if self.is_enabled else 'désactivé'})"


class NotificationEmailLog(models.Model):
    """Journal des notifications : une ligne par destinataire et par tentative."""

    class Statut(models.TextChoices):
        QUEUED = "queued", "En file"
        SENT = "sent", "Envoyé"
        FAILED = "failed", "Échec"
        SKIPPED = "skipped", "Ignoré"

    event_type = models.CharField(
        max_length=32,
        choices=EvenementNotification.choices,
        db_index=True,
    )
    document = models.ForeignKey(
        "gestion_documentaire.DocumentLocalite",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_email",
    )
    document_label = models.CharField(max_length=255, blank=True, default="")
    template_code = models.CharField(max_length=50, blank=True, default="")
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_recues",
    )
    recipient_email = models.CharField(max_length=254, blank=True, default="")
    sujet = models.CharField(max_length=255, blank=True, default="")
    statut = models.CharField(
        max_length=10,
        choices=Statut.choices,
        default=Statut.QUEUED,
        db_index=True,
    )
    skip_reason = models.CharField(max_length=255, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    attempt_count = models.PositiveIntegerField(default=0)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_declenchees",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "journal de notification e-mail"
        verbose_name_plural = "journaux de notification e-mail"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} → {self.recipient_email} ({self.statut})"
