from django.db import migrations

CATALOG_PERMS = [
    ("parametrage", "typedocument", "view_typedocument"),
    ("parametrage", "champsdocument", "view_champsdocument"),
    ("parametrage", "plangeographique", "view_plangeographique"),
    ("parametrage", "structuregeographique", "view_structuregeographique"),
]


def grant_catalog_views(apps, schema_editor):
    """Les groupes qui consultent des documents reçoivent les vues référentiels."""
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")

    try:
        doc_ct = ContentType.objects.get(
            app_label="gestion_documentaire", model="documentlocalite"
        )
    except ContentType.DoesNotExist:
        return

    view_docs = Permission.objects.filter(
        content_type=doc_ct, codename="view_documentlocalite"
    ).first()
    if not view_docs:
        return

    catalog = []
    for app_label, model, codename in CATALOG_PERMS:
        try:
            ct = ContentType.objects.get(app_label=app_label, model=model)
        except ContentType.DoesNotExist:
            continue
        perm = Permission.objects.filter(content_type=ct, codename=codename).first()
        if perm:
            catalog.append(perm)

    if not catalog:
        return

    for group in Group.objects.filter(permissions=view_docs).distinct():
        group.permissions.add(*catalog)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_acces", "0024_sauvegarde_base"),
        ("parametrage", "0012_alter_champsdocument_type_champ_code_barre"),
        ("gestion_documentaire", "0017_telecharger_document_permission"),
    ]

    operations = [
        migrations.RunPython(grant_catalog_views, noop_reverse),
    ]
