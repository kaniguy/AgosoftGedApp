import config.file_validation
import django.core.validators
import gestion_documentaire.services.document_storage
import gestion_documentaire.services.document_version_storage
import gestion_documentaire.services.encrypted_storage
import gestion_documentaire.services.lot_brouillon_storage
from django.db import migrations, models

GED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png',
    'tif', 'tiff', 'webp', 'gif', 'csv', 'txt', 'zip',
]


def ged_validators():
    return [
        django.core.validators.FileExtensionValidator(allowed_extensions=GED_EXTENSIONS),
        config.file_validation.UploadedFileValidator(kind='ged', label='document'),
    ]


def encrypted_storage():
    return gestion_documentaire.services.encrypted_storage.EncryptedDocumentStorage()


class Migration(migrations.Migration):

    dependencies = [
        ('gestion_documentaire', '0017_telecharger_document_permission'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documentlocalite',
            name='fichier',
            field=models.FileField(max_length=1024, storage=encrypted_storage(), upload_to=gestion_documentaire.services.document_storage.document_upload_path, validators=ged_validators()),
        ),
        migrations.AlterField(
            model_name='documentversion',
            name='fichier',
            field=models.FileField(max_length=1024, storage=encrypted_storage(), upload_to=gestion_documentaire.services.document_version_storage.document_version_upload_path, validators=ged_validators()),
        ),
        migrations.AlterField(
            model_name='itemlotbrouillonrattachement',
            name='fichier',
            field=models.FileField(max_length=1024, storage=encrypted_storage(), upload_to=gestion_documentaire.services.lot_brouillon_storage.lot_brouillon_item_upload_path, validators=ged_validators()),
        ),
    ]
