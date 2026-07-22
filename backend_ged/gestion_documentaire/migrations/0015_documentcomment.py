import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gestion_documentaire", "0014_document_edit_tool_permissions"),
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
                    ("commenter_document", "Peut ajouter des commentaires sur un document"),
                ],
                "verbose_name": "Document localité",
                "verbose_name_plural": "Documents localité",
            },
        ),
        migrations.CreateModel(
            name="DocumentComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("texte", models.TextField()),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                (
                    "auteur",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="document_commentaires",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="commentaires",
                        to="gestion_documentaire.documentlocalite",
                    ),
                ),
            ],
            options={
                "verbose_name": "Commentaire document",
                "verbose_name_plural": "Commentaires document",
                "ordering": ["date_creation"],
            },
        ),
    ]
