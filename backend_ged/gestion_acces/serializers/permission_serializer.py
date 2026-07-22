from rest_framework import serializers
from django.contrib.auth.models import Permission
from gestion_acces.services.permission_labels import (
    format_permission_label_fr,
    get_app_label_fr,
    get_model_label_fr,
)


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    name = serializers.SerializerMethodField()
    app_label_display = serializers.SerializerMethodField()
    model_display = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = [
            "id",
            "name",
            "codename",
            "app_label",
            "app_label_display",
            "model",
            "model_display",
        ]

    def get_name(self, obj):
        return format_permission_label_fr(obj)

    def get_app_label_display(self, obj):
        return get_app_label_fr(obj.content_type.app_label)

    def get_model_display(self, obj):
        return get_model_label_fr(obj.content_type.model)
