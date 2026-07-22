# Generated migration — libellés français des permissions Entreprise

from django.db import migrations


def sync_entreprise_labels(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    from gestion_acces.services.permission_labels import format_permission_label_fr

    for perm in Permission.objects.filter(content_type__app_label="gestion_acces", codename__contains="entreprise"):
        label = format_permission_label_fr(perm)
        if perm.name != label:
            perm.name = label
            perm.save(update_fields=["name"])


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0004_entreprise"),
    ]

    operations = [
        migrations.RunPython(sync_entreprise_labels, migrations.RunPython.noop),
    ]
