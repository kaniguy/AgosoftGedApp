from django.db import migrations, models


EVENT_CHOICES = [
    ("soumission", "Soumission au contrôle qualité"),
    ("validation", "Validation du document"),
    ("rejet", "Rejet du document"),
    ("resoumission", "Resoumission après rejet"),
    ("identifiants", "Envoi du mot de passe (création de compte)"),
    ("resume_periodique", "Résumé périodique des documents en attente"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0026_userprofile_suggest_password_change"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificationemaillog",
            name="event_type",
            field=models.CharField(
                choices=EVENT_CHOICES,
                db_index=True,
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="reglenotification",
            name="event_type",
            field=models.CharField(
                choices=EVENT_CHOICES,
                max_length=32,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="reglenotification",
            name="recipient_target",
            field=models.CharField(
                choices=[
                    ("createur", "Créateur du document"),
                    (
                        "controleurs",
                        "Contrôleurs éligibles (permissions + périmètre)",
                    ),
                    ("groupes", "Groupes personnalisés"),
                    ("utilisateurs", "Utilisateurs personnalisés"),
                    ("compte", "Le compte concerné"),
                ],
                default="createur",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="preferencenotification",
            name="notif_identifiants",
            field=models.BooleanField(
                default=True,
                help_text="Recevoir un e-mail lorsqu'un mot de passe est généré pour le compte.",
            ),
        ),
    ]
