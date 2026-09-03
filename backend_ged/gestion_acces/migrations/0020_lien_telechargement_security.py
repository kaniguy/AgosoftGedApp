from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0019_configurationemail_password_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="lientelechargement",
            name="one_time",
            field=models.BooleanField(
                default=True,
                help_text="Si vrai, le lien est désactivé après le premier téléchargement réussi.",
            ),
        ),
        migrations.AddField(
            model_name="lientelechargement",
            name="password_hash",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="lientelechargement",
            name="download_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
