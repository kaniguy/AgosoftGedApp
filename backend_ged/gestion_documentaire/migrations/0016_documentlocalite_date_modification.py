# Champ présent dans le modèle ; ajout conditionnel si absent en base (SQL Server).

import django.utils.timezone
from django.db import migrations, models


def _column_exists(schema_editor, table_name, column_name):
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == "microsoft":
            cursor.execute(
                """
                SELECT 1
                FROM sys.columns
                WHERE object_id = OBJECT_ID(%s)
                  AND name = %s
                """,
                [table_name, column_name],
            )
            return cursor.fetchone() is not None
        return False


def add_date_modification_if_missing(apps, schema_editor):
    table_name = "gestion_documentaire_documentlocalite"
    if _column_exists(schema_editor, table_name, "date_modification"):
        return

    document_localite = apps.get_model("gestion_documentaire", "DocumentLocalite")
    field = models.DateTimeField(auto_now=True, default=django.utils.timezone.now)
    field.set_attributes_from_name("date_modification")
    schema_editor.add_field(document_localite, field)


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0015_documentcomment"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="documentlocalite",
                    name="date_modification",
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    add_date_modification_if_missing,
                    migrations.RunPython.noop,
                ),
            ],
        ),
    ]
