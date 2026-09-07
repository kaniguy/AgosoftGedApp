from rest_framework import serializers
from django.contrib.auth.models import User, Group, Permission
from django.contrib.auth.password_validation import validate_password

from gestion_acces.services.user_credentials_service import (
    finalize_new_user_credentials,
    mark_password_prompt,
    provision_new_user_password,
)


class UserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), many=True, required=False
    )
    user_permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, required=False
    )
    groups_detail = serializers.SerializerMethodField(read_only=True)
    has_usable_password = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "password",
            "groups",
            "user_permissions",
            "groups_detail",
            "has_usable_password",
        ]
        read_only_fields = ["date_joined", "last_login", "has_usable_password"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def get_groups_detail(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def validate(self, attrs):
        request = self.context.get("request")
        # Seul un superutilisateur peut élever les droits d'administration.
        if request and not request.user.is_superuser:
            attrs.pop("is_superuser", None)
            attrs.pop("is_staff", None)
        password = attrs.get("password")
        if password:
            user = self.instance or User(
                **{k: v for k, v in attrs.items() if k not in ("password", "groups", "user_permissions")}
            )
            validate_password(password, user=user)
        return attrs

    def validate_username(self, value):
        qs = User.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ce nom d'utilisateur existe déjà.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        groups = validated_data.pop("groups", [])
        user_permissions = validated_data.pop("user_permissions", [])

        user = User(**validated_data)
        result = provision_new_user_password(user, password)
        user.save()
        user.groups.set(groups)
        user.user_permissions.set(user_permissions)
        actor = None
        request = self.context.get("request")
        if request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            actor = request.user
        result = finalize_new_user_credentials(user, result, actor=actor)
        mark_password_prompt(user, enabled=user.has_usable_password())
        user._credential_result = result
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        groups = validated_data.pop("groups", None)
        user_permissions = validated_data.pop("user_permissions", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            mark_password_prompt(instance, enabled=True)

        instance.save()

        if groups is not None:
            instance.groups.set(groups)
        if user_permissions is not None:
            instance.user_permissions.set(user_permissions)

        return instance
