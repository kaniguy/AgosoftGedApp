from django.db import migrations

PERM = ("telecharger_document", "Peut télécharger un document")

DOCUMENT_PERMISSIONS = [
    ("qc_soumettre", "Peut soumettre au contrôle qualité"),
    ("qc_valider", "Peut valider (contrôle qualité)"),
    ("qc_rejeter", "Peut rejeter (contrôle qualité)"),
    ("qc_menu_en_attente", "Peut voir le menu docs en attente (QC)"),
    ("qc_menu_brouillon", "Peut voir le menu docs brouillon (QC)"),
    ("qc_menu_rejete", "Peut voir le menu docs rejetés (QC)"),
    ("qc_menu_valide", "Peut voir le menu docs validés (QC)"),
    ("annoter_document", "Peut annoter un document (surlignage, cadre, texte, stylo)"),
    ("tamponner_document", "Peut apposer des tampons sur un document"),
    ("signer_document", "Peut signer un document"),
    ("commenter_document", "Peut ajouter des commentaires sur un document"),
    PERM,
]


def grant_download_to_view_groups(apps, schema_editor):
    """Attribue le téléchargement aux groupes qui peuvent déjà consulter un document."""
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")

    try:
        ct = ContentType.objects.get(app_label="gestion_documentaire", model="documentlocalite")
    except ContentType.DoesNotExist:
        return

    view_perm = Permission.objects.filter(content_type=ct, codename="view_documentlocalite").first()
    download_perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=PERM[0],
        defaults={"name": PERM[1]},
    )
    if not view_perm:
        return

    for group in Group.objects.filter(permissions=view_perm).distinct():
        group.permissions.add(download_perm)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0016_documentlocalite_date_modification"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="documentlocalite",
            options={
                "ordering": ["-date_creation"],
                "permissions": DOCUMENT_PERMISSIONS,
                "verbose_name": "Document localité",
                "verbose_name_plural": "Documents localité",
            },
        ),
        migrations.RunPython(grant_download_to_view_groups, noop_reverse),
    ]
