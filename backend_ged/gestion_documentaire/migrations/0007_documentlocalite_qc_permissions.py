from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0006_statut_en_attente_validation"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="documentlocalite",
            options={
                "ordering": ["-date_creation"],
                "permissions": [
                    ("qc_soumettre", "Peut soumettre au contrôle qualité"),
                    ("qc_valider", "Peut valider (contrôle qualité)"),
                    ("qc_rejeter", "Peut rejeter (contrôle qualité)"),
                ],
                "verbose_name": "Document localité",
                "verbose_name_plural": "Documents localité",
            },
        ),
    ]
