from rest_framework import serializers
from ..models import StructureGeographique

class StructureGeographiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = StructureGeographique
        fields = ["id", "ordre", "code", "libelle", "description", "date_creation", "date_modification", "created_by", "updated_by"]

    def validate_ordre(self, value):
        if value < 1:
            raise serializers.ValidationError("L'ordre doit être supérieur ou égal à 1.")
        return value