from rest_framework import serializers

from gestion_acces.models.configuration_email import ConfigurationEmail

BACKEND_CHOICES = (
    ("django.core.mail.backends.smtp.EmailBackend", "SMTP (production)"),
    ("django.core.mail.backends.console.EmailBackend", "Console (développement)"),
)


class ConfigurationEmailSerializer(serializers.ModelSerializer):
    email_host_password = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        style={"input_type": "password"},
    )
    has_password = serializers.SerializerMethodField(read_only=True)
    email_backend = serializers.ChoiceField(choices=BACKEND_CHOICES, required=False)

    class Meta:
        model = ConfigurationEmail
        fields = [
            "email_backend",
            "email_host",
            "email_port",
            "email_use_tls",
            "email_use_ssl",
            "email_host_user",
            "email_host_password",
            "has_password",
            "default_from_email",
            "date_modification",
        ]
        read_only_fields = ["date_modification", "has_password"]

    def get_has_password(self, obj):
        return bool(obj.email_host_password)

    def validate(self, attrs):
        use_tls = attrs.get(
            "email_use_tls",
            self.instance.email_use_tls if self.instance else True,
        )
        use_ssl = attrs.get(
            "email_use_ssl",
            self.instance.email_use_ssl if self.instance else False,
        )
        if use_tls and use_ssl:
            raise serializers.ValidationError(
                {"email_use_ssl": "TLS et SSL ne peuvent pas être activés en même temps."}
            )
        port = attrs.get("email_port", self.instance.email_port if self.instance else 587)
        if port is not None and (int(port) < 1 or int(port) > 65535):
            raise serializers.ValidationError({"email_port": "Port invalide (1–65535)."})
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("email_host_password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        # Mot de passe : ne pas écraser si champ laissé vide
        if password is not None and str(password).strip() != "":
            instance.email_host_password = password
        instance.save()
        return instance
