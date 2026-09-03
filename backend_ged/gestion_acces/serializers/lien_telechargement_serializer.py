from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from gestion_acces.models.lien_telechargement import ALLOWED_VALIDITY_HOURS, LienTelechargement
from gestion_acces.services.access_service import filter_document_queryset
from gestion_acces.services.lien_telechargement_service import (
    build_documents_summaries_map,
    get_link_document_availability,
)
from gestion_documentaire.models import DocumentLocalite


class LienTelechargementSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()
    documents_available_count = serializers.SerializerMethodField()
    documents_missing_count = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    created_by_label = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    can_download = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = LienTelechargement
        fields = [
            "id",
            "token",
            "document_ids",
            "document_count",
            "documents_available_count",
            "documents_missing_count",
            "documents",
            "validity_hours",
            "expires_at",
            "is_active",
            "is_expired",
            "can_download",
            "status_label",
            "one_time",
            "has_password",
            "download_count",
            "created_at",
            "created_by",
            "created_by_username",
            "created_by_label",
            "download_url",
        ]
        read_only_fields = fields

    def _availability(self, obj):
        cached = getattr(obj, "_availability_cache", None)
        if cached is None:
            cached = get_link_document_availability(obj.document_ids)
            obj._availability_cache = cached
        return cached

    def get_document_count(self, obj):
        return self._availability(obj)["total"]

    def get_documents_available_count(self, obj):
        return self._availability(obj)["downloadable"]

    def get_documents_missing_count(self, obj):
        return self._availability(obj)["missing"]

    def get_documents(self, obj):
        cached = getattr(obj, "_documents_summaries", None)
        if cached is not None:
            return cached
        return build_documents_summaries_map(obj.document_ids)

    def get_can_download(self, obj):
        avail = self._availability(obj)
        return obj.is_active and not obj.is_expired() and avail["downloadable"] > 0

    def get_has_password(self, obj):
        return obj.has_password

    def get_created_by_label(self, obj):
        if not obj.created_by:
            return "—"
        full = f"{obj.created_by.first_name or ''} {obj.created_by.last_name or ''}".strip()
        return full or obj.created_by.username

    def get_download_url(self, obj):
        base = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
        return f"{base}/telechargement/{obj.token}"

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_status_label(self, obj):
        if not obj.is_active:
            if obj.download_count and obj.one_time:
                return "Utilisé (usage unique)"
            return "Désactivé"
        if obj.is_expired():
            return "Expiré"
        avail = self._availability(obj)
        if avail["downloadable"] == 0:
            return "Documents indisponibles"
        if avail["downloadable"] < avail["total"]:
            return "Partiellement indisponible"
        return "Actif"


class LienTelechargementCreateSerializer(serializers.Serializer):
    document_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=500,
    )
    validity_hours = serializers.IntegerField()
    recipient_email = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    one_time = serializers.BooleanField(required=False, default=True)
    password = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        max_length=128,
        style={"input_type": "password"},
    )

    def validate_validity_hours(self, value):
        if value not in ALLOWED_VALIDITY_HOURS:
            raise serializers.ValidationError("Durée invalide. Choix : 3, 5, 12 ou 24 heures.")
        return value

    def validate_password(self, value):
        raw = (value or "").strip()
        if not raw:
            return ""
        if len(raw) < 4:
            raise serializers.ValidationError(
                "Le mot de passe du lien doit contenir au moins 4 caractères."
            )
        return raw

    def validate_recipient_email(self, value):
        from gestion_acces.services.lien_telechargement_email_service import parse_recipient_emails

        raw = (value or "").strip()
        if not raw:
            return []
        try:
            return parse_recipient_emails(raw)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_document_ids(self, value):
        unique = []
        seen = set()
        for doc_id in value:
            if doc_id not in seen:
                seen.add(doc_id)
                unique.append(doc_id)
        if not unique:
            raise serializers.ValidationError("Sélectionnez au moins un document.")
        return unique

    def validate(self, attrs):
        user = self.context["request"].user
        doc_ids = attrs["document_ids"]
        qs = filter_document_queryset(
            DocumentLocalite.objects.filter(id__in=doc_ids).select_related("type_document"),
            user,
        )
        found_ids = set(qs.values_list("id", flat=True))
        missing = [i for i in doc_ids if i not in found_ids]
        if missing:
            raise serializers.ValidationError(
                {"document_ids": "Un ou plusieurs documents sont introuvables ou inaccessibles."}
            )
        attrs["documents"] = list(qs)
        return attrs

    def create(self, validated_data):
        hours = validated_data["validity_hours"]
        doc_ids = validated_data["document_ids"]
        recipients = validated_data.get("recipient_email") or []
        one_time = validated_data.get("one_time", True)
        password = validated_data.get("password") or ""
        user = self.context["request"].user
        expires_at = timezone.now() + timezone.timedelta(hours=hours)
        link = LienTelechargement(
            document_ids=doc_ids,
            validity_hours=hours,
            expires_at=expires_at,
            created_by=user,
            one_time=bool(one_time),
        )
        if password:
            link.set_password(password)
        link.save()
        if recipients:
            from gestion_acces.services.lien_telechargement_email_service import (
                queue_download_link_email,
            )

            queue_download_link_email(
                link.pk,
                recipients,
                sender_user_id=getattr(user, "pk", None),
            )
            link._email_sent_to = "; ".join(recipients)
            link._email_queued = True
        return link
