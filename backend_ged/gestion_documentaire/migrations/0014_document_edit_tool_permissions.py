from django.db import migrations

TOOL_PERMS = [
    ("annoter_document", "Peut annoter un document (surlignage, cadre, texte, stylo)"),
    ("tamponner_document", "Peut apposer des tampons sur un document"),
    ("signer_document", "Peut signer un document"),
    ("commenter_document", "Peut ajouter des notes / commentaires sur un document"),
]


def grant_edit_tools_to_change_groups(apps, schema_editor):
    """Crée et attribue les droits d'édition PDF aux groupes qui peuvent modifier un document."""
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")

    try:
        ct = ContentType.objects.get(app_label="gestion_documentaire", model="documentlocalite")
    except ContentType.DoesNotExist:
        return

    change_perm = Permission.objects.filter(content_type=ct, codename="change_documentlocalite").first()
    if not change_perm:
        return

    tool_perms = []
    for codename, name in TOOL_PERMS:
        perm, _ = Permission.objects.get_or_create(
            content_type=ct,
            codename=codename,
            defaults={"name": name},
        )
        tool_perms.append(perm)

    for group in Group.objects.filter(permissions=change_perm).distinct():
        group.permissions.add(*tool_perms)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0013_secure_document_version_validators"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="documentlocalite",
            options={
                "ordering": ["-date_creation"],
                "permissions": [
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
                    ("commenter_document", "Peut ajouter des notes / commentaires sur un document"),
                ],
                "verbose_name": "Document localité",
                "verbose_name_plural": "Documents localité",
            },
        ),
        migrations.RunPython(grant_edit_tools_to_change_groups, noop_reverse),
    ]
