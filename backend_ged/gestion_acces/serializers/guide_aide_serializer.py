import os
import re

from rest_framework import serializers

from config.file_validation import drf_validate_document
from gestion_acces.models.guide_aide import (
    GUIDE_AIDE_MODULE_CODES,
    GuideAide,
    GuideAideDocument,
)
from gestion_documentaire.services.document_storage import download_display_filename

_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})"
)
_YOUTUBE_ID_ONLY_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extract_youtube_id(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    match = _YOUTUBE_ID_RE.search(raw)
    if match:
        return match.group(1)
    if _YOUTUBE_ID_ONLY_RE.fullmatch(raw):
        return raw
    return ""


class GuideAideDocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    nom = serializers.SerializerMethodField()

    class Meta:
        model = GuideAideDocument
        fields = ["id", "nom", "url"]

    def get_url(self, obj):
        if not obj.fichier:
            return None
        request = self.context.get("request")
        url = obj.fichier.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_nom(self, obj):
        raw = obj.nom_original or os.path.basename(obj.fichier.name or "")
        return download_display_filename(raw, fallback="document")


class GuideAideSerializer(serializers.ModelSerializer):
    module_libelle = serializers.CharField(source="get_module_code_display", read_only=True)
    youtube_id = serializers.SerializerMethodField()
    youtube_embed_url = serializers.SerializerMethodField()
    etapes = serializers.SerializerMethodField()
    documents = GuideAideDocumentSerializer(many=True, read_only=True)
    documents_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
    )
    delete_document_ids = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = GuideAide
        fields = [
            "id",
            "module_code",
            "module_libelle",
            "titre",
            "description",
            "youtube_url",
            "youtube_id",
            "youtube_embed_url",
            "guide",
            "etapes",
            "documents",
            "documents_files",
            "delete_document_ids",
            "ordre",
            "actif",
            "date_modification",
        ]

    def get_youtube_id(self, obj):
        return extract_youtube_id(obj.youtube_url)

    def get_youtube_embed_url(self, obj):
        video_id = extract_youtube_id(obj.youtube_url)
        if not video_id:
            return None
        return f"https://www.youtube.com/embed/{video_id}"

    def get_etapes(self, obj):
        lines = [line.strip() for line in (obj.guide or "").splitlines()]
        return [line for line in lines if line]

    def validate_module_code(self, value):
        if value not in GUIDE_AIDE_MODULE_CODES:
            raise serializers.ValidationError("Module d'aide inconnu.")
        return value

    def validate_youtube_url(self, value):
        raw = (value or "").strip()
        if not raw:
            return ""
        if not extract_youtube_id(raw):
            raise serializers.ValidationError(
                "Lien YouTube invalide. Utilisez une URL youtube.com ou youtu.be."
            )
        video_id = extract_youtube_id(raw)
        return f"https://www.youtube.com/watch?v={video_id}"

    def to_internal_value(self, data):
        files = []
        if hasattr(data, "getlist"):
            files = [f for f in data.getlist("documents_files") if f]
            data = data.copy()
            data.pop("documents_files", None)
        ret = super().to_internal_value(data)
        if files:
            ret["documents_files"] = self.fields["documents_files"].run_validation(files)
        return ret

    def validate_documents_files(self, files):
        for fichier in files or []:
            drf_validate_document(fichier)
        return files

    def _parse_delete_ids(self, raw):
        if not raw:
            return []
        ids = []
        for part in str(raw).split(","):
            part = part.strip()
            if part.isdigit():
                ids.append(int(part))
        return ids

    def _save_documents(self, guide, files):
        for fichier in files or []:
            GuideAideDocument.objects.create(
                guide=guide,
                fichier=fichier,
                nom_original=os.path.basename(getattr(fichier, "name", "") or "document"),
            )

    def _delete_documents(self, guide, ids):
        if not ids:
            return
        rows = guide.documents.filter(pk__in=ids)
        for row in rows:
            if row.fichier:
                row.fichier.delete(save=False)
            row.delete()

    def create(self, validated_data):
        files = validated_data.pop("documents_files", [])
        validated_data.pop("delete_document_ids", None)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user
        guide = super().create(validated_data)
        self._save_documents(guide, files)
        return guide

    def update(self, instance, validated_data):
        files = validated_data.pop("documents_files", [])
        delete_ids = self._parse_delete_ids(validated_data.pop("delete_document_ids", ""))
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user
        guide = super().update(instance, validated_data)
        self._delete_documents(guide, delete_ids)
        self._save_documents(guide, files)
        return guide
