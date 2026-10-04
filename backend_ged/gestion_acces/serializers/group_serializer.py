from rest_framework import serializers
from django.contrib.auth.models import Group, Permission, User
from parametrage.models import PlanGeographique, TypeDocument
from ..models.group_profile import GroupProfile
from ..constants import VALID_MODULE_CODES, MODULE_DEFAULT_VIEW_PERMISSIONS
from ..permission_tree import expand_permission_objects
from ..services.access_service import build_localite_chemin
from gestion_acces.services.permission_labels import format_permission_label_fr

QC_MENU_PERMISSION_CODENAMES = {
    "gestion_documentaire.qc_menu_en_attente",
    "gestion_documentaire.qc_menu_rejete",
    "gestion_documentaire.qc_menu_valide",
}


def _permissions_from_codenames(full_codenames):
    """Résout app_label.codename vers des objets Permission existants."""
    found = []
    for full in full_codenames:
        app_label, _, codename = full.partition(".")
        if not app_label or not codename:
            continue
        perm = Permission.objects.filter(
            content_type__app_label=app_label, codename=codename
        ).first()
        if perm:
            found.append(perm)
    return found


def _default_view_permissions_for_modules(modules):
    """Permissions de consultation minimales pour entrer dans les modules cochés."""
    codenames = []
    seen = set()
    for code in modules or []:
        for full in MODULE_DEFAULT_VIEW_PERMISSIONS.get(code, []):
            if full not in seen:
                seen.add(full)
                codenames.append(full)
    return _permissions_from_codenames(codenames)


def _ensure_controle_qualite_menus(permissions, modules):
    """Le module contrôle qualité est invisible sans au moins un menu QC : on les ajoute si aucun n'est coché."""
    permissions = list(permissions or [])
    if "controle_qualite" not in (modules or []):
        return permissions
    codenames = {f"{p.content_type.app_label}.{p.codename}" for p in permissions}
    if codenames & QC_MENU_PERMISSION_CODENAMES:
        return permissions
    return permissions + _permissions_from_codenames(sorted(QC_MENU_PERMISSION_CODENAMES))


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
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "is_active",
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

    def _is_lite(self):
        request = self.context.get("request")
        return bool(request and request.query_params.get("lite") == "1")

    def _skip_details(self):
        if self._is_lite():
            return True
        view = self.context.get("view")
        return getattr(view, "action", None) == "list"

    def get_permissions_detail(self, obj):
        """Détail lisible des permissions Django du groupe."""
        if self._skip_details():
            return []
        return [
            {"id": p.id, "name": format_permission_label_fr(p), "codename": p.codename}
            for p in obj.permissions.all()
        ]

    def get_users_detail(self, obj):
        """Liste des utilisateurs membres du groupe."""
        if self._skip_details():
            return []
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
        annotated = getattr(obj, "users_count_ann", None)
        if annotated is not None:
            return annotated
        return obj.user_set.count()

    def get_localites_detail(self, obj):
        """Localités du dernier niveau avec leur chemin hiérarchique."""
        if self._skip_details():
            return []
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
        if self._skip_details():
            return []
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
            return [], [], [], True
        return (
            list(profile.modules or []),
            [loc.id for loc in profile.localites.all()],
            [td.id for td in profile.types_documents.all()],
            bool(profile.is_active),
        )

    def to_representation(self, instance):
        """Injecte modules, localites, types de documents et utilisateurs dans la réponse API."""
        if self._is_lite():
            profile = getattr(instance, "ged_profile", None)
            annotated = getattr(instance, "users_count_ann", None)
            return {
                "id": instance.id,
                "name": instance.name,
                "is_active": True if profile is None else bool(profile.is_active),
                "users_count": annotated if annotated is not None else 0,
            }

        data = super().to_representation(instance)
        modules, localite_ids, type_doc_ids, is_active = self._read_profile_fields(instance)
        data["modules"] = modules
        data["localites"] = localite_ids
        data["types_documents"] = type_doc_ids
        data["is_active"] = is_active
        data["users"] = [u.id for u in instance.user_set.all()]
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
        niveaux = PlanGeographique.structure_niveaux_ordered()
        for loc in value:
            if loc.get_niveau_enfant(niveaux) is not None:
                errors.append(
                    f"« {loc.libelle} » n'est pas au dernier niveau du plan de classement."
                )
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def _save_profile(
        self, group, modules=None, localites=None, types_documents=None, is_active=None
    ):
        """Persiste modules, localités, types de documents et statut dans GroupProfile."""
        profile, _ = GroupProfile.objects.get_or_create(group=group)
        update_fields = []

        if modules is not None:
            profile.modules = modules
            update_fields.append("modules")

        if is_active is not None:
            GroupProfile.objects.filter(pk=profile.pk).update(is_active=is_active)
            profile.is_active = is_active

        if update_fields:
            profile.save(update_fields=update_fields)

        if localites is not None:
            profile.localites.set(localites)

        if types_documents is not None:
            profile.types_documents.set(types_documents)

        group.ged_profile = profile

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
        is_active = validated_data.pop("is_active", True)

        if not permissions:
            permissions = _default_view_permissions_for_modules(modules)
        permissions = expand_permission_objects(
            _ensure_controle_qualite_menus(permissions, modules)
        )

        group = Group.objects.create(**validated_data)
        group.permissions.set(permissions)
        self._save_profile(
            group,
            modules=modules,
            localites=localites,
            types_documents=types_documents,
            is_active=is_active,
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
        is_active = validated_data.pop("is_active", None)

        if "name" in validated_data:
            instance.name = validated_data["name"]
            instance.save(update_fields=["name"])
        elif validated_data:
            instance.save()

        effective_modules = modules if modules is not None else list(
            getattr(getattr(instance, "ged_profile", None), "modules", None) or []
        )
        if permissions is not None:
            if not permissions:
                permissions = _default_view_permissions_for_modules(effective_modules)
            instance.permissions.set(expand_permission_objects(
                _ensure_controle_qualite_menus(permissions, effective_modules)
            ))
        elif modules is not None:
            current = list(instance.permissions.all())
            completed = _ensure_controle_qualite_menus(current, effective_modules)
            if len(completed) != len(current):
                instance.permissions.set(expand_permission_objects(completed))

        self._save_profile(
            instance,
            modules=modules,
            localites=localites,
            types_documents=types_documents,
            is_active=is_active,
        )
        self._sync_group_users(instance, users)
        return instance
