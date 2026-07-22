from rest_framework import serializers

from gestion_documentaire.models.document_comment import DocumentComment


class DocumentCommentSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = DocumentComment
        fields = [
            "id",
            "document",
            "texte",
            "auteur",
            "auteur_nom",
            "is_mine",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = [
            "id",
            "document",
            "auteur",
            "auteur_nom",
            "is_mine",
            "date_creation",
            "date_modification",
        ]

    def get_auteur_nom(self, obj):
        user = obj.auteur
        if not user:
            return "Utilisateur inconnu"
        full = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return full or user.username or f"Utilisateur #{user.pk}"

    def get_is_mine(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.auteur_id == request.user.id

    def validate_texte(self, value):
        texte = (value or "").strip()
        if not texte:
            raise serializers.ValidationError("Le commentaire ne peut pas être vide.")
        if len(texte) > 255:
            raise serializers.ValidationError("Le commentaire est trop long (max. 255 caractères).")
        return texte
