from django.conf import settings
from django.db import models


class JournalActivite(models.Model):
    """Trace des actions utilisateurs : connexions, déconnexions et opérations métier."""

    class Action(models.TextChoices):
        CONNEXION = "connexion", "Connexion"
        DECONNEXION = "deconnexion", "Déconnexion"
        CONNEXION_ECHOUEE = "connexion_echouee", "Connexion échouée"
        CREATION = "creation", "Création"
        MODIFICATION = "modification", "Modification"
        SUPPRESSION = "suppression", "Suppression"
        SOUMETTRE_QC = "soumettre_qc", "Soumettre QC"
        VALIDER_QC = "valider_qc", "Valider QC"
        REJETER_QC = "rejeter_qc", "Rejeter QC"
        ANNOTER = "annoter", "Annotation"
        TAMPONNER = "tamponner", "Tampon"
        SIGNER = "signer", "Signature"
        COMMENTER = "commenter", "Note"
        TELECHARGER = "telecharger", "Téléchargement"
        ENVOYER_EMAIL = "envoyer_email", "Envoi e-mail"
        EXPORTER = "exporter", "Export"
        RESTAURER = "restaurer", "Restauration"
        REINITIALISER = "reinitialiser", "Réinitialisation"
        AUTRE = "autre", "Autre"

    class Categorie(models.TextChoices):
        AUTHENTIFICATION = "authentification", "Authentification"
        UTILISATEURS = "utilisateurs", "Utilisateurs"
        GROUPES = "groupes", "Groupes"
        DOCUMENTS = "documents", "Documents"
        PARAMETRAGE = "parametrage", "Paramétrage"
        LIENS = "liens", "Liens de téléchargement"
        ENTREPRISE = "entreprise", "Entreprise"
        CONFIGURATION_EMAIL = "configuration_email", "Configuration e-mail"
        JOURNAL = "journal", "Journal d'activité"
        BASE_DONNEES = "base_donnees", "Base de données"
        AUTRE = "autre", "Autre"

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_activites",
    )
    nom_utilisateur = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Identifiant conservé même si le compte est supprimé.",
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    categorie = models.CharField(
        max_length=32,
        choices=Categorie.choices,
        default=Categorie.AUTRE,
        db_index=True,
    )
    description = models.CharField(max_length=500)
    objet_type = models.CharField(max_length=100, blank=True, default="")
    objet_id = models.CharField(max_length=64, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    methode_http = models.CharField(max_length=10, blank=True, default="")
    chemin = models.CharField(max_length=512, blank=True, default="")
    date_creation = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "journal d'activité"
        verbose_name_plural = "journaux d'activité"
        ordering = ["-date_creation"]

    def __str__(self):
        who = self.nom_utilisateur or (self.utilisateur_id and str(self.utilisateur_id)) or "?"
        return f"{who} — {self.get_action_display()} — {self.date_creation}"
