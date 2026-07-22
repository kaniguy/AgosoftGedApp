"""Les documents brouillon existants sont considérés comme déjà validés (données historiques)."""

from django.db import migrations


def mark_existing_brouillons_as_valides(apps, schema_editor):
    DocumentLocalite = apps.get_model("gestion_documentaire", "DocumentLocalite")
    DocumentLocalite.objects.filter(statut_qualite="brouillon").update(statut_qualite="valide")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0004_document_statut_qualite"),
    ]

    operations = [
        migrations.RunPython(mark_existing_brouillons_as_valides, noop_reverse),
    ]
