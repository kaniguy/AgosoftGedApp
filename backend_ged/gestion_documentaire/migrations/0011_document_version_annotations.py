from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import gestion_documentaire.services.document_version_storage


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gestion_documentaire", "0010_lot_brouillon_partage_localite"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentlocalite",
            name="annotations",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="version_courante",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.CreateModel(
            name="DocumentVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version_number", models.PositiveIntegerField()),
                (
                    "fichier",
                    models.FileField(
                        max_length=1024,
                        upload_to=gestion_documentaire.services.document_version_storage.document_version_upload_path,
                    ),
                ),
                ("valeurs_snapshot", models.JSONField(blank=True, default=list)),
                ("annotations", models.JSONField(blank=True, default=list)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("commentaire", models.CharField(blank=True, default="", max_length=255)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="document_versions_creees",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="gestion_documentaire.documentlocalite",
                    ),
                ),
            ],
            options={
                "verbose_name": "Version document",
                "verbose_name_plural": "Versions document",
                "ordering": ["-date_creation", "-id"],
            },
        ),
    ]
