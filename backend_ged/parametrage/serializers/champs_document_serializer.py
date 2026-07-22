from django.db import transaction
from django.db.models import Max
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from ..models.champs_document import ChampsDocument, OptionChamp


def _decaler_champs_pour_ordre(type_document, nouvel_ordre, exclude_id=None):
    """Décale de +1 les champs dont l'ordre est >= nouvel_ordre (création)."""
    qs = ChampsDocument.objects.filter(
        type_document=type_document,
        ordre__gte=nouvel_ordre,
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)

    for champ in qs.order_by("-ordre"):
        champ.ordre += 1
        champ.save(update_fields=["ordre"])


def _reorganiser_ordre_champ(instance, nouvel_ordre):
    """Réorganise les ordres des autres champs lors d'une modification."""
    ancien_ordre = instance.ordre
    if nouvel_ordre == ancien_ordre or nouvel_ordre < 1:
        return

    max_ordre = (
        ChampsDocument.objects.filter(type_document=instance.type_document)
        .exclude(id=instance.id)
        .aggregate(Max("ordre"))["ordre__max"]
        or 0
    )
    ordre_temporaire = max_ordre + 1_000_000
    ChampsDocument.objects.filter(id=instance.id).update(ordre=ordre_temporaire)

    autres = ChampsDocument.objects.filter(
        type_document=instance.type_document
    ).exclude(id=instance.id)

    if nouvel_ordre < ancien_ordre:
        champs_a_decaler = autres.filter(
            ordre__gte=nouvel_ordre,
            ordre__lt=ancien_ordre,
        ).order_by("-ordre")
        for champ in champs_a_decaler:
            champ.ordre += 1
            champ.save(update_fields=["ordre"])
    else:
        champs_a_decaler = autres.filter(
            ordre__gt=ancien_ordre,
            ordre__lte=nouvel_ordre,
        ).order_by("ordre")
        for champ in champs_a_decaler:
            champ.ordre -= 1
            champ.save(update_fields=["ordre"])


class OptionChampSerializer(serializers.ModelSerializer):
    class Meta:
        model = OptionChamp
        fields = ["id", "valeur"]


class ChampsDocumentSerializer(serializers.ModelSerializer):
    options = OptionChampSerializer(many=True, required=False)
    has_capture_zone = serializers.BooleanField(read_only=True)

    class Meta:
        model = ChampsDocument
        fields = [
            "id",
            "type_document",
            "libelle_champ",
            "type_champ",
            "obligatoire",
            "ordre",
            "date_creation",
            "options",
            "capture_page",
            "zone_x",
            "zone_y",
            "zone_width",
            "zone_height",
            "has_capture_zone",
        ]

    def get_validators(self):
        """L'unicité type_document + ordre est gérée par décalage automatique."""
        return [
            validator
            for validator in super().get_validators()
            if not isinstance(validator, UniqueTogetherValidator)
        ]

    def validate_ordre(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError(
                "L'ordre doit être supérieur ou égal à 1."
            )
        return value

    def create(self, validated_data):
        """Crée un champ document et ses options associées."""
        options_data = validated_data.pop("options", [])
        type_document = validated_data["type_document"]
        ordre = validated_data.get("ordre")

        with transaction.atomic():
            list(
                ChampsDocument.objects.select_for_update().filter(
                    type_document=type_document
                )
            )

            if ordre is None:
                dernier_ordre = ChampsDocument.objects.filter(
                    type_document=type_document
                ).aggregate(Max("ordre"))["ordre__max"]
                validated_data["ordre"] = (dernier_ordre or 0) + 1
            elif ChampsDocument.objects.filter(
                type_document=type_document, ordre=ordre
            ).exists():
                _decaler_champs_pour_ordre(type_document, ordre)

            champ = ChampsDocument.objects.create(**validated_data)

            for option_data in options_data:
                OptionChamp.objects.create(champ=champ, **option_data)

        return champ

    def update(self, instance, validated_data):
        """Met à jour un champ document et remplace ses options si fournies."""
        options_data = validated_data.pop("options", None)
        nouvel_ordre = validated_data.get("ordre", instance.ordre)
        type_document = validated_data.get("type_document", instance.type_document)

        with transaction.atomic():
            list(
                ChampsDocument.objects.select_for_update().filter(
                    type_document=type_document
                )
            )

            if (
                "ordre" in validated_data
                and nouvel_ordre != instance.ordre
                and type_document == instance.type_document
            ):
                _reorganiser_ordre_champ(instance, nouvel_ordre)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

        if options_data is not None:
            instance.options.all().delete()
            for option_data in options_data:
                OptionChamp.objects.create(champ=instance, **option_data)

        instance.refresh_from_db()
        return instance


class CaptureZoneItemSerializer(serializers.Serializer):
    """Élément de mise à jour groupée des zones de capture."""

    champ_id = serializers.IntegerField()
    capture_page = serializers.IntegerField(min_value=0, default=0)
    zone_x = serializers.FloatField(required=False, allow_null=True)
    zone_y = serializers.FloatField(required=False, allow_null=True)
    zone_width = serializers.FloatField(required=False, allow_null=True)
    zone_height = serializers.FloatField(required=False, allow_null=True)


class CaptureZonesBulkSerializer(serializers.Serializer):
    """Corps de requête pour enregistrer toutes les zones d'un type de document."""

    zones = CaptureZoneItemSerializer(many=True)
