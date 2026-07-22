# Generated manually for QR field type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("parametrage", "0009_alter_champsdocument_options_and_more"),
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
                ],
                max_length=50,
            ),
        ),
    ]
