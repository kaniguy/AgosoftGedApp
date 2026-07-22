from rest_framework import serializers
from ..models.entreprise import Entreprise
from config.file_validation import drf_validate_image


class EntrepriseSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Entreprise
        fields = [
            "libelle",
            "slogan",
            "description",
            "email",
            "telephone",
            "logo",
            "date_modification",
        ]
        read_only_fields = ["date_modification"]

    def get_logo(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.logo.url)
        return obj.logo.url

    def validate(self, attrs):
        request = self.context.get("request")
        if request and "logo" in request.FILES:
            drf_validate_image(request.FILES["logo"], label="logo")
        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")

        instance.libelle = validated_data.get("libelle", instance.libelle)
        instance.slogan = validated_data.get("slogan", instance.slogan)
        instance.description = validated_data.get("description", instance.description)
        instance.email = validated_data.get("email", instance.email)
        instance.telephone = validated_data.get("telephone", instance.telephone)

        if request and "logo" in request.FILES:
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = request.FILES["logo"]
        elif request and request.data.get("remove_logo") == "true":
            if instance.logo:
                instance.logo.delete(save=True)

        instance.save()  # ALLOWED — logo mime/content_type validated in validate()
        return instance
