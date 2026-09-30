from django.conf import settings
from django.db import migrations


def staff_follows_superuser(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    User.objects.filter(is_superuser=False, is_staff=True).update(is_staff=False)


class Migration(migrations.Migration):
    dependencies = [
        ("gestion_acces", "0030_superusers_are_staff"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(staff_follows_superuser, migrations.RunPython.noop),
    ]
