# Generated manually for signature password protection

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0017_alter_notificationemaillog_event_type_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersignature",
            name="password_hash",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
    ]
