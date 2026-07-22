from rest_framework import serializers

from ..models import TypeDocument


class TypeDocumentSerializer(serializers.ModelSerializer):
    champs_count = serializers.IntegerField(source="champs.count", read_only=True)
    fichier_modele_url = serializers.SerializerMethodField()
    zones_capture_count = serializers.SerializerMethodField()

    class Meta:
        model = TypeDocument
        fields = [
            "id",
            "code",
            "libelle",
            "description",
            "date_creation",
            "champs_count",
            "fichier_modele",
            "fichier_modele_url",
            "modele_page_count",
            "zones_capture_count",
        ]
        read_only_fields = ["fichier_modele", "modele_page_count"]

    def get_fichier_modele_url(self, obj) -> str | None:
        """Retourne l'URL absolue du fichier modèle si présent."""
        if not obj.fichier_modele:
            return None
        request = self.context.get("request")
        url = obj.fichier_modele.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def get_zones_capture_count(self, obj) -> int:
        """Compte les champs ayant une zone de capture complète."""
        return sum(1 for champ in obj.champs.all() if champ.has_capture_zone)
