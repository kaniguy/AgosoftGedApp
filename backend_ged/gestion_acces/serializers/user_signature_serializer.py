from rest_framework import serializers

from config.file_validation import drf_validate_image
from ..models.user_signature import UserSignature


class UserSignatureSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    has_password = serializers.BooleanField(read_only=True)
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=128,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )
    current_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = UserSignature
        fields = [
            "id",
            "label",
            "is_default",
            "created_at",
            "image",
            "image_url",
            "has_password",
            "password",
            "password_confirm",
            "current_password",
        ]
        read_only_fields = ["id", "created_at", "image_url", "has_password"]
        extra_kwargs = {
            "image": {"write_only": True, "required": True},
            "label": {"required": False, "allow_blank": True},
        }

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url

    def validate_image(self, value):
        drf_validate_image(value, label="signature")
        return value

    def validate(self, attrs):
        password_provided = "password" in attrs
        password = attrs.get("password") or ""
        password_confirm = attrs.pop("password_confirm", "") or ""
        current_password = attrs.pop("current_password", "") or ""

        if password_provided and (password or password_confirm):
            if len(password) < 4:
                raise serializers.ValidationError(
                    {"password": "Le mot de passe doit contenir au moins 4 caractères."}
                )
            if password != password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": "Les mots de passe ne correspondent pas."}
                )

        # Modifier / retirer un mot de passe existant → ancien obligatoire
        if self.instance and self.instance.has_password and password_provided:
            if not self.instance.check_password(current_password):
                raise serializers.ValidationError(
                    {"current_password": "Mot de passe actuel incorrect."}
                )

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        password = validated_data.pop("password", "") or ""
        validated_data.pop("current_password", None)
        is_default = validated_data.get("is_default", False)
        if is_default or not UserSignature.objects.filter(user=user).exists():
            UserSignature.objects.filter(user=user, is_default=True).update(is_default=False)
            validated_data["is_default"] = True
        signature = UserSignature(user=user, **validated_data)
        if password:
            signature.set_password(password)
        signature.save()
        return signature

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("current_password", None)
        if validated_data.get("is_default"):
            UserSignature.objects.filter(user=instance.user, is_default=True).exclude(
                pk=instance.pk
            ).update(is_default=False)
        instance = super().update(instance, validated_data)
        if password is not None:
            instance.set_password(password)
            instance.save(update_fields=["password_hash"])
        return instance
