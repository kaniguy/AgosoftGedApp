from rest_framework import serializers

from gestion_acces.models.journal_activite import JournalActivite


class JournalActiviteSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    categorie_label = serializers.CharField(source="get_categorie_display", read_only=True)
    prenom = serializers.SerializerMethodField()
    nom = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    utilisateur_display = serializers.SerializerMethodField()

    class Meta:
        model = JournalActivite
        fields = [
            "id",
            "utilisateur",
            "nom_utilisateur",
            "prenom",
            "nom",
            "email",
            "utilisateur_display",
            "action",
            "action_label",
            "categorie",
            "categorie_label",
            "description",
            "objet_type",
            "objet_id",
            "details",
            "adresse_ip",
            "user_agent",
            "methode_http",
            "chemin",
            "date_creation",
        ]

    def get_prenom(self, obj):
        if obj.utilisateur_id:
            return obj.utilisateur.first_name or ""
        return ""

    def get_nom(self, obj):
        if obj.utilisateur_id:
            return obj.utilisateur.last_name or ""
        return ""

    def get_email(self, obj):
        if obj.utilisateur_id:
            return obj.utilisateur.email or ""
        return ""

    def get_utilisateur_display(self, obj):
        if obj.utilisateur_id:
            u = obj.utilisateur
            full = f"{u.first_name or ''} {u.last_name or ''}".strip()
            return full or u.username
        return obj.nom_utilisateur or "—"
