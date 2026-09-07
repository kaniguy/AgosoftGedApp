from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0025_grant_document_catalog_views"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="suggest_password_change",
            field=models.BooleanField(
                default=False,
                help_text="Proposer (sans forcer) un changement de mot de passe à la connexion.",
            ),
        ),
    ]
