from django.contrib.auth.models import Group, User
from rest_framework import serializers

from gestion_acces.models.notification import (
    ConfigurationResumePeriodique,
    ModeleEmailNotification,
    NotificationEmailLog,
    PreferenceNotification,
    RegleNotification,
)


class ModeleEmailNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModeleEmailNotification
        fields = [
            "id",
            "code",
            "nom",
            "sujet",
            "corps_texte",
            "corps_html",
            "is_active",
            "date_modification",
        ]
        read_only_fields = ["id", "code", "nom", "date_modification"]


class RegleNotificationSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    recipient_groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), many=True, required=False
    )
    recipient_users = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False
    )
    recipient_groups_detail = serializers.SerializerMethodField(read_only=True)
    recipient_users_detail = serializers.SerializerMethodField(read_only=True)
    modele_code = serializers.CharField(source="modele.code", read_only=True, default="")

    class Meta:
        model = RegleNotification
        fields = [
            "id",
            "event_type",
            "event_type_label",
            "is_enabled",
            "recipient_target",
            "recipient_groups",
            "recipient_users",
            "recipient_groups_detail",
            "recipient_users_detail",
            "exclude_actor",
            "respecter_preferences",
            "modele_code",
            "date_modification",
        ]
        read_only_fields = ["id", "event_type", "event_type_label", "modele_code", "date_modification"]

    def get_recipient_groups_detail(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.recipient_groups.all()]

    def get_recipient_users_detail(self, obj):
        return [
            {
                "id": u.id,
                "username": u.username,
                "nom": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username,
                "email": u.email or "",
            }
            for u in obj.recipient_users.all()
        ]


class ConfigurationResumePeriodiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationResumePeriodique
        fields = [
            "is_enabled",
            "frequence",
            "heure_envoi",
            "jour_semaine",
            "min_documents",
            "dernier_envoi",
            "date_modification",
        ]
        read_only_fields = ["dernier_envoi", "date_modification"]


class PreferenceNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenceNotification
        fields = [
            "notif_soumission",
            "notif_resoumission",
            "notif_validation",
            "notif_rejet",
            "resume_periodique",
            "date_modification",
        ]
        read_only_fields = ["date_modification"]


class NotificationEmailLogSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    recipient_nom = serializers.SerializerMethodField()
    triggered_by_nom = serializers.SerializerMethodField()

    class Meta:
        model = NotificationEmailLog
        fields = [
            "id",
            "event_type",
            "event_type_label",
            "document",
            "document_label",
            "template_code",
            "recipient_nom",
            "recipient_email",
            "sujet",
            "statut",
            "statut_label",
            "skip_reason",
            "error_message",
            "attempt_count",
            "triggered_by_nom",
            "created_at",
            "sent_at",
        ]

    def _display_name(self, user):
        if not user:
            return ""
        full = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return full or user.username

    def get_recipient_nom(self, obj):
        return self._display_name(obj.recipient_user)

    def get_triggered_by_nom(self, obj):
        return self._display_name(obj.triggered_by)
