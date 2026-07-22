from django.db import migrations, models
from django.db.models import Count


def merge_duplicate_lots_per_localite(apps, schema_editor):
    """Fusionne les brouillons multiples d'une même localité (un par utilisateur) en un seul lot."""
    Lot = apps.get_model("gestion_documentaire", "LotBrouillonRattachement")
    Item = apps.get_model("gestion_documentaire", "ItemLotBrouillonRattachement")

    duplicate_localites = list(
        Lot.objects.values("localite_id")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
        .order_by()
        .values_list("localite_id", flat=True)
    )

    for localite_id in duplicate_localites:
        lots = list(
            Lot.objects.filter(localite_id=localite_id)
            .order_by("-date_modification", "-id")
        )
        if len(lots) < 2:
            continue
        keeper = lots[0]
        for lot in lots[1:]:
            for item in Item.objects.filter(lot_id=lot.id):
                if Item.objects.filter(
                    lot_id=keeper.id, identifiant_client=item.identifiant_client
                ).exists():
                    item.delete()
                else:
                    item.lot_id = keeper.id
                    item.save(update_fields=["lot_id"])
            lot.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("gestion_documentaire", "0009_lot_brouillon_rattachement"),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_lots_per_localite, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="lotbrouillonrattachement",
            name="uniq_lot_brouillon_user_localite",
        ),
        migrations.AddConstraint(
            model_name="lotbrouillonrattachement",
            constraint=models.UniqueConstraint(
                fields=("localite",),
                name="uniq_lot_brouillon_localite",
            ),
        ),
    ]
