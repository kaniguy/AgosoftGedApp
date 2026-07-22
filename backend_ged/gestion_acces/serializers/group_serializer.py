from rest_framework import serializers
from django.contrib.auth.models import Group, Permission, User
from parametrage.models import PlanGeographique, TypeDocument
from ..models.group_profile import GroupProfile
from ..constants import VALID_MODULE_CODES
from ..services.access_service import build_localite_chemin
from gestion_acces.services.permission_labels import format_permission_label_fr


class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.select_related("content_type").all(),
        many=True,
        required=False,
    )
    permissions_detail = serializers.SerializerMethodField(read_only=True)
    users_count = serializers.SerializerMethodField(read_only=True)
    users = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False, write_only=True
    )
    users_detail = serializers.SerializerMethodField(read_only=True)
    modules = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    localites = serializers.PrimaryKeyRelatedField(
        queryset=PlanGeographique.objects.select_related("niveau").all(),
        many=True,
        required=False,
    )
    localites_detail = serializers.SerializerMethodField(read_only=True)
    types_documents = serializers.PrimaryKeyRelatedField(
        queryset=TypeDocument.objects.all(),
        many=True,
        required=False,
    )
    types_documents_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "permissions",
            "permissions_detail",
            "users",
            "users_detail",
            "users_count",
            "modules",
            "localites",
            "localites_detail",
            "types_documents",
            "types_documents_detail",
        ]

    def get_permissions_detail(self, obj):
        """Détail lisible des permissions Django du groupe."""
        return [
            {"id": p.id, "name": format_permission_label_fr(p), "codename": p.codename}
            for p in obj.permissions.all()
        ]

    def get_users_detail(self, obj):
        """Liste des utilisateurs membres du groupe."""
        return [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email or "",
                "first_name": u.first_name,
                "last_name": u.last_name,
                "is_active": u.is_active,
            }
            for u in obj.user_set.all()
        ]

    def get_users_count(self, obj):
        """Nombre d'utilisateurs membres du groupe."""
        return obj.user_set.count()

    def get_localites_detail(self, obj):
        """Localités du dernier niveau avec leur chemin hiérarchique."""
        profile = getattr(obj, "ged_profile", None)
        if not profile:
            return []

        results = []
        for loc in profile.localites.all():
            chemin = build_localite_chemin(loc)
            results.append(
                {
                    "id": loc.id,
                    "libelle": loc.libelle,
                    "code": loc.code,
                    "chemin_str": " > ".join(item["libelle"] for item in chemin),
                }
            )
        return results

    def get_types_documents_detail(self, obj):
        """Types de documents autorisés pour ce groupe."""
        profile = getattr(obj, "ged_profile", None)
        if not profile:
            return []

        return [
            {
                "id": td.id,
                "libelle": td.libelle,
                "code": td.code,
            }
            for td in profile.types_documents.all()
        ]

    def _read_profile_fields(self, obj):
        """Charge modules, localites et types de documents depuis le profil pour la lecture."""
        profile = getattr(obj, "ged_profile", None)
        if not profile:
            return [], [], []
        return (
            list(profile.modules or []),
            list(profile.localites.values_list("id", flat=True)),
            list(profile.types_documents.values_list("id", flat=True)),
        )

    def to_representation(self, instance):
        """Injecte modules, localites, types de documents et utilisateurs dans la réponse API."""
        data = super().to_representation(instance)
        modules, localite_ids, type_doc_ids = self._read_profile_fields(instance)
        data["modules"] = modules
        data["localites"] = localite_ids
        data["types_documents"] = type_doc_ids
        data["users"] = list(instance.user_set.values_list("id", flat=True))
        return data

    def validate_modules(self, value):
        """Vérifie que les codes modules sont reconnus."""
        invalid = [c for c in value if c not in VALID_MODULE_CODES]
        if invalid:
            raise serializers.ValidationError(
                f"Modules invalides : {', '.join(invalid)}"
            )
        return value

    def validate_localites(self, value):
        """Seules les localités du dernier niveau peuvent être assignées."""
        errors = []
        for loc in value:
            if loc.get_niveau_enfant() is not None:
                errors.append(
                    f"« {loc.libelle} » n'est pas au dernier niveau du plan géographique."
                )
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def _save_profile(self, group, modules=None, localites=None, types_documents=None):
        """Persiste modules, localités et types de documents dans GroupProfile."""
        profile, _ = GroupProfile.objects.get_or_create(group=group)

        if modules is not None:
            profile.modules = modules
            profile.save(update_fields=["modules"])

        if localites is not None:
            profile.localites.set(localites)

        if types_documents is not None:
            profile.types_documents.set(types_documents)

    def _sync_group_users(self, group, users):
        """Ajoute ou retire les utilisateurs du groupe sans toucher aux autres groupes."""
        if users is None:
            return

        new_ids = {u.id for u in users}
        current_ids = set(group.user_set.values_list("id", flat=True))

        to_add = new_ids - current_ids
        to_remove = current_ids - new_ids

        for user in User.objects.filter(id__in=to_add):
            user.groups.add(group)
        for user in User.objects.filter(id__in=to_remove):
            user.groups.remove(group)

    def create(self, validated_data):
        """Crée le groupe Django puis son profil d'accès et assigne les utilisateurs."""
        permissions = validated_data.pop("permissions", [])
        modules = validated_data.pop("modules", [])
        localites = validated_data.pop("localites", [])
        types_documents = validated_data.pop("types_documents", [])
        users = validated_data.pop("users", [])

        group = Group.objects.create(**validated_data)
        group.permissions.set(permissions)
        self._save_profile(
            group,
            modules=modules,
            localites=localites,
            types_documents=types_documents,
        )
        self._sync_group_users(group, users)
        return group

    def update(self, instance, validated_data):
        """Met à jour le groupe, son profil d'accès et ses membres."""
        permissions = validated_data.pop("permissions", None)
        modules = validated_data.pop("modules", None)
        localites = validated_data.pop("localites", None)
        types_documents = validated_data.pop("types_documents", None)
        users = validated_data.pop("users", None)

        instance.name = validated_data.get("name", instance.name)
        instance.save()

        if permissions is not None:
            instance.permissions.set(permissions)

        self._save_profile(
            instance,
            modules=modules,
            localites=localites,
            types_documents=types_documents,
        )
        self._sync_group_users(instance, users)
        return instance
