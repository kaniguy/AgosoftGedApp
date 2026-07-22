from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0005_entreprise_permission_labels"),
    ]

    operations = [
        migrations.AddField(
            model_name="entreprise",
            name="description",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="entreprise",
            name="email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="entreprise",
            name="telephone",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AlterField(
            model_name="entreprise",
            name="libelle",
            field=models.CharField(default="AGOSOFT-GED", max_length=50),
        ),
    ]
