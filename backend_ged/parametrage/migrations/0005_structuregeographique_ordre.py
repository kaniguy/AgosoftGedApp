# Generated manually for ordre field on StructureGeographique

from django.db import migrations, models


def populate_ordre(apps, schema_editor):
    StructureGeographique = apps.get_model('parametrage', 'StructureGeographique')
    for index, structure in enumerate(
        StructureGeographique.objects.all().order_by('id'),
        start=1,
    ):
        structure.ordre = index
        structure.save(update_fields=['ordre'])


def reverse_ordre(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('parametrage', '0004_plangeographique'),
    ]

    operations = [
        migrations.AddField(
            model_name='structuregeographique',
            name='ordre',
            field=models.IntegerField(default=1),
            preserve_default=False,
        ),
        migrations.RunPython(populate_ordre, reverse_ordre),
        migrations.AlterField(
            model_name='structuregeographique',
            name='ordre',
            field=models.IntegerField(unique=True),
        ),
        migrations.AlterModelOptions(
            name='structuregeographique',
            options={
                'ordering': ['ordre'],
                'verbose_name': 'Structure géographique',
                'verbose_name_plural': 'Structures géographiques',
            },
        ),
    ]
