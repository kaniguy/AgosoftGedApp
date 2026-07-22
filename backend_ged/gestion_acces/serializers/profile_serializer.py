from rest_framework import serializers
from django.contrib.auth.models import User
from ..models.user_profile import UserProfile
from config.file_validation import drf_validate_image


class UserSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    signature = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "photo", "signature"]
        read_only_fields = ["id", "username"]

    def _absolute_media_url(self, file_field):
        if not file_field:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(file_field.url)
        return file_field.url

    def get_photo(self, obj):
        try:
            return self._absolute_media_url(obj.profile.photo)
        except UserProfile.DoesNotExist:
            return None

    def get_signature(self, obj):
        try:
            return self._absolute_media_url(obj.profile.signature)
        except UserProfile.DoesNotExist:
            return None

    def validate(self, attrs):
        request = self.context.get("request")
        if request and "photo" in request.FILES:
            drf_validate_image(request.FILES["photo"], label="photo")
        if request and "signature" in request.FILES:
            drf_validate_image(request.FILES["signature"], label="signature")
        return attrs

    def update(self, instance, validated_data):
        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)
        instance.email = validated_data.get("email", instance.email)
        instance.save()  # ALLOWED mime validated before assignment

        request = self.context.get("request")
        if not request:
            return instance

        profile, _created = UserProfile.objects.get_or_create(user=instance)

        if "photo" in request.FILES:
            if profile.photo:
                profile.photo.delete(save=False)
            profile.photo = request.FILES["photo"]
            profile.save()  # ALLOWED — photo mime/content_type already validated
        elif request.data.get("remove_photo") == "true":
            if profile.photo:
                profile.photo.delete(save=True)  # ALLOWED — removal only

        if "signature" in request.FILES:
            if profile.signature:
                profile.signature.delete(save=False)
            profile.signature = request.FILES["signature"]
            profile.save()  # ALLOWED — signature mime/content_type already validated
        elif request.data.get("remove_signature") == "true":
            if profile.signature:
                profile.signature.delete(save=True)  # ALLOWED — removal only

        return instance
