import django.core.validators
from django.db import migrations, models
import config.file_validation


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0010_secure_file_upload_validators"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="signature",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="profile_signatures/",
                validators=[
                    django.core.validators.FileExtensionValidator(
                        allowed_extensions=["jpg", "jpeg", "png", "webp", "gif"]
                    ),
                    config.file_validation.UploadedFileValidator(kind="image", label="signature"),
                ],
            ),
        ),
    ]
