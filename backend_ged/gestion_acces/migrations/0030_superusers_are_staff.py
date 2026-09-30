from django.conf import settings
from django.db import migrations


def superusers_are_staff(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    User.objects.filter(is_superuser=True, is_staff=False).update(is_staff=True)


class Migration(migrations.Migration):
    dependencies = [
        ("gestion_acces", "0029_move_app_settings_to_parametrage"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(superusers_are_staff, migrations.RunPython.noop),
    ]
