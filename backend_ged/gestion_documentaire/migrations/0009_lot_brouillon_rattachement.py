import gestion_documentaire.models.lot_brouillon
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("parametrage", "0001_initial"),
        ("gestion_documentaire", "0008_documentlocalite_qc_menu_permissions"),
    ]

    operations = [
        migrations.CreateModel(
            name="LotBrouillonRattachement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("index_actif", models.PositiveIntegerField(default=0)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                (
                    "localite",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lots_brouillon_rattachement",
                        to="parametrage.plangeographique",
                    ),
                ),
                (
                    "type_document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="lots_brouillon_rattachement",
                        to="parametrage.typedocument",
                    ),
                ),
                (
                    "utilisateur",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lots_brouillon_rattachement",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Lot brouillon rattachement",
                "verbose_name_plural": "Lots brouillon rattachement",
                "ordering": ["-date_modification"],
            },
        ),
        migrations.CreateModel(
            name="ItemLotBrouillonRattachement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("identifiant_client", models.CharField(max_length=64)),
                ("ordre", models.PositiveIntegerField(default=0)),
                ("nom_fichier", models.CharField(default="document.pdf", max_length=255)),
                ("fichier", models.FileField(max_length=1024, upload_to=gestion_documentaire.models.lot_brouillon.lot_brouillon_item_upload_path)),
                ("field_values", models.JSONField(blank=True, default=dict)),
                ("zone_overrides", models.JSONField(blank=True, default=dict)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                (
                    "lot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="gestion_documentaire.lotbrouillonrattachement",
                    ),
                ),
            ],
            options={
                "verbose_name": "Item lot brouillon",
                "verbose_name_plural": "Items lot brouillon",
                "ordering": ["ordre", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="lotbrouillonrattachement",
            constraint=models.UniqueConstraint(
                fields=("utilisateur", "localite"),
                name="uniq_lot_brouillon_user_localite",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemlotbrouillonrattachement",
            constraint=models.UniqueConstraint(
                fields=("lot", "identifiant_client"),
                name="uniq_item_lot_client_id",
            ),
        ),
    ]
