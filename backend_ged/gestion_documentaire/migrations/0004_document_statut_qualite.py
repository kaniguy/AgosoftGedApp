from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gestion_documentaire", "0003_document_fichier_max_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentlocalite",
            name="statut_qualite",
            field=models.CharField(
                choices=[
                    ("brouillon", "Brouillon"),
                    ("valide", "Validé"),
                    ("rejete", "Rejeté"),
                ],
                default="brouillon",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="valide_par",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="documents_valides",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="valide_le",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="rejete_par",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="documents_rejetes",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="rejete_le",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentlocalite",
            name="motif_rejet",
            field=models.TextField(blank=True, default=""),
        ),
    ]
