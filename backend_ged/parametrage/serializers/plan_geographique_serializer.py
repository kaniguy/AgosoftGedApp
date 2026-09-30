from rest_framework import serializers
from ..models import PlanGeographique


class PlanGeographiqueSerializer(serializers.ModelSerializer):

    can_add_child = serializers.SerializerMethodField()
    a_des_enfants = serializers.SerializerMethodField()
    niveau_libelle = serializers.CharField(source="niveau.libelle", read_only=True)
    niveau_ordre = serializers.IntegerField(source="niveau.ordre", read_only=True)
    nb_enfants = serializers.IntegerField(read_only=True, required=False)
    nb_documents = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = PlanGeographique
        fields = [
            "id",
            "niveau",
            "niveau_libelle",
            "niveau_ordre",
            "parent",
            "libelle",
            "code",
            "description",
            "longitude",
            "latitude",
            "can_add_child",
            "a_des_enfants",
            "nb_enfants",
            "nb_documents",
            "created_by",
            "updated_by",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = ("niveau", "parent", "created_by", "updated_by", "nb_enfants")
        extra_kwargs = {
            "description": {"allow_blank": True, "required": False},
            "code": {"allow_blank": True, "allow_null": True, "required": False},
        }

    def get_can_add_child(self, obj):
        niveaux = self.context.get("_structure_niveaux")
        if niveaux is None:
            niveaux = PlanGeographique.structure_niveaux_ordered()
            self.context["_structure_niveaux"] = niveaux
        return obj.get_niveau_enfant(niveaux) is not None

    def get_a_des_enfants(self, obj):
        nb = getattr(obj, "nb_enfants", None)
        if nb is not None:
            return nb > 0
        return obj.enfants.exists()

    def validate_description(self, value):
        return value or ""

    def validate(self, attrs):
        parent = self.instance.parent if self.instance else attrs.get("parent")
        niveau = self.instance.niveau if self.instance else attrs.get("niveau")
        code = attrs.get("code", getattr(self.instance, "code", None))

        if code and niveau:
            queryset = PlanGeographique.objects.filter(niveau=niveau, code=code)
            if parent:
                queryset = queryset.filter(parent=parent)
            else:
                queryset = queryset.filter(parent__isnull=True)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"code": f"Un élément avec le code '{code}' existe déjà à ce niveau."}
                )

        return attrs
