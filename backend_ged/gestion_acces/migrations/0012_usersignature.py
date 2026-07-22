import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import config.file_validation


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gestion_acces", "0011_userprofile_signature"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserSignature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "image",
                    models.FileField(
                        upload_to="user_signatures/",
                        validators=[
                            django.core.validators.FileExtensionValidator(
                                allowed_extensions=["jpg", "jpeg", "png", "webp", "gif"]
                            ),
                            config.file_validation.UploadedFileValidator(kind="image", label="signature"),
                        ],
                    ),
                ),
                ("label", models.CharField(blank=True, default="", max_length=120)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="signatures",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "signature utilisateur",
                "verbose_name_plural": "signatures utilisateur",
                "ordering": ["-is_default", "-created_at"],
            },
        ),
    ]
