# Generated manually for code-barres field type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("parametrage", "0011_secure_file_upload_validators"),
    ]

    operations = [
        migrations.AlterField(
            model_name="champsdocument",
            name="type_champ",
            field=models.CharField(
                choices=[
                    ("texte", "Texte court"),
                    ("texte_long", "Texte long"),
                    ("nombre", "Nombre"),
                    ("date", "Date"),
                    ("datetime", "Date et heure"),
                    ("choix", "Choix multiple"),
                    ("select", "Liste déroulante"),
                    ("qr", "Code QR"),
                    ("code_barre", "Code barre"),
                ],
                max_length=50,
            ),
        ),
    ]
