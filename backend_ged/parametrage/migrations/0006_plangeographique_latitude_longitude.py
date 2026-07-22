from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('parametrage', '0005_structuregeographique_ordre'),
    ]

    operations = [
        migrations.AddField(
            model_name='plangeographique',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name='plangeographique',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
