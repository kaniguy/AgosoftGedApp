from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0027_identifiants_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupprofile",
            name="is_active",
            field=models.BooleanField(
                default=True,
                help_text="Si désactivé, le groupe n'accorde plus de droits (les membres sont conservés).",
            ),
        ),
    ]
