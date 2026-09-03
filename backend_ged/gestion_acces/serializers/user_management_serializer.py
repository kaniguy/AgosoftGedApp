from rest_framework import serializers
from django.contrib.auth.models import User, Group, Permission
from django.contrib.auth.password_validation import validate_password


class UserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), many=True, required=False
    )
    user_permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, required=False
    )
    groups_detail = serializers.SerializerMethodField(read_only=True)

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
        ]
        read_only_fields = ["date_joined", "last_login"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def get_groups_detail(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

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

        if not password:
            raise serializers.ValidationError({"password": "Le mot de passe est requis."})

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(groups)
        user.user_permissions.set(user_permissions)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        groups = validated_data.pop("groups", None)
        user_permissions = validated_data.pop("user_permissions", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if groups is not None:
            instance.groups.set(groups)
        if user_permissions is not None:
            instance.user_permissions.set(user_permissions)

        return instance
