from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0007_documentlocalite_qc_permissions"),
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
                    ("qc_menu_en_attente", "Peut voir le menu docs en attente (QC)"),
                    ("qc_menu_brouillon", "Peut voir le menu docs brouillon (QC)"),
                    ("qc_menu_rejete", "Peut voir le menu docs rejetés (QC)"),
                    ("qc_menu_valide", "Peut voir le menu docs validés (QC)"),
                ],
                "verbose_name": "Document localité",
                "verbose_name_plural": "Documents localité",
            },
        ),
    ]
