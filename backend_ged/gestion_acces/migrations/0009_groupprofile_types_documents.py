from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("parametrage", "0009_alter_champsdocument_options_and_more"),
        ("gestion_acces", "0008_lien_telechargement"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupprofile",
            name="types_documents",
            field=models.ManyToManyField(
                blank=True,
                help_text="Types de documents accessibles via ce groupe (vide = tous)",
                related_name="groupes_acces",
                to="parametrage.typedocument",
            ),
        ),
    ]
