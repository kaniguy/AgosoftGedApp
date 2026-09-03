from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0023_guide_aide_permissions"),
    ]

    operations = [
        migrations.CreateModel(
            name="SauvegardeBase",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
            ],
            options={
                "verbose_name": "base de données",
                "verbose_name_plural": "bases de données",
                "managed": False,
                "default_permissions": ("view",),
                "permissions": (
                    ("exporter_sauvegardebase", "Peut exporter la base de données"),
                    ("restaurer_sauvegardebase", "Peut restaurer la base de données"),
                    (
                        "reinitialiser_sauvegardebase",
                        "Peut réinitialiser la base de données",
                    ),
                ),
            },
        ),
        migrations.AlterField(
            model_name="journalactivite",
            name="action",
            field=models.CharField(
                choices=[
                    ("connexion", "Connexion"),
                    ("deconnexion", "Déconnexion"),
                    ("connexion_echouee", "Connexion échouée"),
                    ("creation", "Création"),
                    ("modification", "Modification"),
                    ("suppression", "Suppression"),
                    ("soumettre_qc", "Soumettre QC"),
                    ("valider_qc", "Valider QC"),
                    ("rejeter_qc", "Rejeter QC"),
                    ("annoter", "Annotation"),
                    ("tamponner", "Tampon"),
                    ("signer", "Signature"),
                    ("commenter", "Note"),
                    ("telecharger", "Téléchargement"),
                    ("envoyer_email", "Envoi e-mail"),
                    ("exporter", "Export"),
                    ("restaurer", "Restauration"),
                    ("reinitialiser", "Réinitialisation"),
                    ("autre", "Autre"),
                ],
                db_index=True,
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="journalactivite",
            name="categorie",
            field=models.CharField(
                choices=[
                    ("authentification", "Authentification"),
                    ("utilisateurs", "Utilisateurs"),
                    ("groupes", "Groupes"),
                    ("documents", "Documents"),
                    ("parametrage", "Paramétrage"),
                    ("liens", "Liens de téléchargement"),
                    ("entreprise", "Entreprise"),
                    ("configuration_email", "Configuration e-mail"),
                    ("journal", "Journal d'activité"),
                    ("base_donnees", "Base de données"),
                    ("autre", "Autre"),
                ],
                db_index=True,
                default="autre",
                max_length=32,
            ),
        ),
    ]
