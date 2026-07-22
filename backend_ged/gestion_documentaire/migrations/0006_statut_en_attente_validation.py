from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0005_brouillon_to_valide"),
    ]

    operations = [
        migrations.AlterField(
            model_name="documentlocalite",
            name="statut_qualite",
            field=models.CharField(
                choices=[
                    ("brouillon", "Brouillon"),
                    ("en_attente", "En attente de validation"),
                    ("valide", "Validé"),
                    ("rejete", "Rejeté"),
                ],
                default="brouillon",
                max_length=20,
            ),
        ),
    ]
