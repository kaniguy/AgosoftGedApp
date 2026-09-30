from django.db import migrations

# Pages Entreprise / SMTP / Notifications / Aide Vidéo passées du module
# « gestion_acces » au module « parametrage » : les groupes qui avaient ces droits
# reçoivent le module Paramétrage pour conserver leur accès.
MOVED_PERMISSION_CODENAMES = [
    "view_entreprise",
    "change_entreprise",
    "view_configurationemail",
    "change_configurationemail",
    "view_reglenotification",
    "change_reglenotification",
    "view_modeleemailnotification",
    "change_modeleemailnotification",
    "view_configurationresumeperiodique",
    "change_configurationresumeperiodique",
    "view_notificationemaillog",
    # view_guideaide est aussi utilisé par les simples lecteurs des tutoriels
    "add_guideaide",
    "change_guideaide",
    "delete_guideaide",
]


def add_parametrage_module(apps, schema_editor):
    GroupProfile = apps.get_model("gestion_acces", "GroupProfile")

    profiles = GroupProfile.objects.filter(
        group__permissions__content_type__app_label="gestion_acces",
        group__permissions__codename__in=MOVED_PERMISSION_CODENAMES,
    ).distinct()

    for profile in profiles:
        modules = profile.modules
        if not isinstance(modules, list) or not modules or "parametrage" in modules:
            continue
        profile.modules = [*modules, "parametrage"]
        profile.save(update_fields=["modules"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0028_groupprofile_is_active"),
    ]

    operations = [
        migrations.RunPython(add_parametrage_module, noop_reverse),
    ]
