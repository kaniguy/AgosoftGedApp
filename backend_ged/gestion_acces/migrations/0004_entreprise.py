from django.db import migrations, models


def create_default_entreprise(apps, schema_editor):
    Entreprise = apps.get_model("gestion_acces", "Entreprise")
    Entreprise.objects.get_or_create(
        pk=1,
        defaults={
            "libelle": "AGOSOFT-GED",
            "slogan": "Gestion Électronique de Documents",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0003_french_permission_labels"),
    ]

    operations = [
        migrations.CreateModel(
            name="Entreprise",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("libelle", models.CharField(default="AGOSOFT-GED", max_length=255)),
                (
                    "slogan",
                    models.CharField(
                        blank=True,
                        default="Gestion Électronique de Documents",
                        max_length=255,
                    ),
                ),
                ("logo", models.FileField(blank=True, null=True, upload_to="entreprise/")),
                ("date_modification", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "entreprise",
                "verbose_name_plural": "entreprises",
            },
        ),
        migrations.RunPython(create_default_entreprise, migrations.RunPython.noop),
    ]
