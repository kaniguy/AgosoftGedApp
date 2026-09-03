from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0018_usersignature_password_hash"),
    ]

    operations = [
        migrations.AlterField(
            model_name="configurationemail",
            name="email_host_password",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
    ]
