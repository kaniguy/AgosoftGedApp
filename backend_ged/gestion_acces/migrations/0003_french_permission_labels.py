from django.db import migrations


def apply_french_permission_labels(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    from gestion_acces.services.permission_labels import format_permission_label_fr

    for perm in Permission.objects.select_related("content_type").all():
        label = format_permission_label_fr(perm)
        if perm.name != label:
            perm.name = label
            perm.save(update_fields=["name"])


def revert_permission_labels(apps, schema_editor):
    # Pas de retour arrière fiable : les libellés anglais d'origine ne sont pas conservés.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0002_groupprofile"),
    ]

    operations = [
        migrations.RunPython(apply_french_permission_labels, revert_permission_labels),
    ]
