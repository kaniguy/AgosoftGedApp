# Generated manually for capture zones feature

from django.db import migrations, models
import parametrage.services.capture_storage


class Migration(migrations.Migration):

    dependencies = [
        ("parametrage", "0007_alter_champsdocument_type_champ"),
    ]

    operations = [
        migrations.AddField(
            model_name="typedocument",
            name="fichier_modele",
            field=models.FileField(
                blank=True,
                help_text="PDF ou image servant de modèle pour l'encadrement des champs.",
                null=True,
                upload_to=parametrage.services.capture_storage.capture_modele_upload_path,
            ),
        ),
        migrations.AddField(
            model_name="typedocument",
            name="modele_page_count",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Nombre de pages du document modèle (mis à jour à l'upload).",
            ),
        ),
        migrations.AddField(
            model_name="champsdocument",
            name="capture_page",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Index de page (0 = première page) où se trouve la zone.",
            ),
        ),
        migrations.AddField(
            model_name="champsdocument",
            name="zone_x",
            field=models.FloatField(
                blank=True,
                help_text="Position X normalisée du coin supérieur gauche de la zone.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="champsdocument",
            name="zone_y",
            field=models.FloatField(
                blank=True,
                help_text="Position Y normalisée du coin supérieur gauche de la zone.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="champsdocument",
            name="zone_width",
            field=models.FloatField(
                blank=True,
                help_text="Largeur normalisée de la zone de capture.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="champsdocument",
            name="zone_height",
            field=models.FloatField(
                blank=True,
                help_text="Hauteur normalisée de la zone de capture.",
                null=True,
            ),
        ),
    ]
