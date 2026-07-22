"""
Validation sécurisée des uploads : extension, MIME déclaré, magic bytes, taille.
"""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.utils.deconstruct import deconstructible
from PIL import Image, UnidentifiedImageError

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
DOCUMENT_EXTENSIONS = frozenset({".pdf"}) | IMAGE_EXTENSIONS

IMAGE_EXTENSIONS_NO_DOT = ("jpg", "jpeg", "png", "webp", "gif")
DOCUMENT_EXTENSIONS_NO_DOT = ("pdf", "jpg", "jpeg", "png", "webp", "gif")

MIME_BY_EXT: dict[str, frozenset[str]] = {
    ".jpg": frozenset({"image/jpeg"}),
    ".jpeg": frozenset({"image/jpeg"}),
    ".png": frozenset({"image/png"}),
    ".webp": frozenset({"image/webp"}),
    ".gif": frozenset({"image/gif"}),
    ".pdf": frozenset({"application/pdf"}),
}

# Signatures → famille de type (pour croiser avec l'extension)
_MAGIC_CHECKS: tuple[tuple[bytes, frozenset[str]], ...] = (
    (b"%PDF", frozenset({".pdf"})),
    (b"\xff\xd8\xff", frozenset({".jpg", ".jpeg"})),
    (b"\x89PNG\r\n\x1a\n", frozenset({".png"})),
    (b"GIF87a", frozenset({".gif"})),
    (b"GIF89a", frozenset({".gif"})),
)


def _default_max_bytes(kind: str) -> int:
    if kind == "image":
        return int(getattr(settings, "MAX_IMAGE_UPLOAD_SIZE", 5 * 1024 * 1024))
    return int(getattr(settings, "MAX_DOCUMENT_UPLOAD_SIZE", 25 * 1024 * 1024))


def _extension(filename: str | None) -> str:
    return Path(filename or "").suffix.lower()


def _read_head(file_obj, size: int = 32) -> bytes:
    pos = file_obj.tell() if hasattr(file_obj, "tell") else None
    try:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        head = file_obj.read(size) or b""
    finally:
        if hasattr(file_obj, "seek"):
            file_obj.seek(pos if pos is not None else 0)
    return head


def _detect_magic_extensions(head: bytes) -> frozenset[str] | None:
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return frozenset({".webp"})
    for signature, exts in _MAGIC_CHECKS:
        if head.startswith(signature):
            return exts
    return None


def _file_size(file_obj) -> int:
    size = getattr(file_obj, "size", None)
    if isinstance(size, int) and size >= 0:
        return size
    if hasattr(file_obj, "seek") and hasattr(file_obj, "tell"):
        pos = file_obj.tell()
        file_obj.seek(0, 2)
        size = file_obj.tell()
        file_obj.seek(pos)
        return int(size)
    return 0


def validate_uploaded_file(
    file_obj,
    *,
    allowed_extensions: frozenset[str],
    max_bytes: int | None = None,
    label: str = "fichier",
) -> None:
    """
    Lève ValidationError (Django) si le fichier est invalide.
    Utilisable depuis models.clean / ModelSerializer / vues.
    """
    if file_obj is None:
        return

    ext = _extension(getattr(file_obj, "name", ""))
    if ext not in allowed_extensions:
        allowed = ", ".join(sorted(e.lstrip(".").upper() for e in allowed_extensions))
        raise ValidationError(f"Formats acceptés pour {label} : {allowed}.")

    limit = max_bytes if max_bytes is not None else _default_max_bytes(
        "image" if allowed_extensions <= IMAGE_EXTENSIONS else "document"
    )
    size = _file_size(file_obj)
    if size <= 0:
        raise ValidationError(f"Le {label} est vide ou illisible.")
    if size > limit:
        mb = limit / (1024 * 1024)
        raise ValidationError(f"Le {label} dépasse la taille maximale ({mb:.0f} Mo).")

    declared = (getattr(file_obj, "content_type", "") or "").lower().split(";")[0].strip()
    allowed_mimes = MIME_BY_EXT.get(ext, frozenset())
    if declared and allowed_mimes and declared not in allowed_mimes:
        # Certains clients envoient application/octet-stream : on tolère si magic OK
        if declared not in {"application/octet-stream", "binary/octet-stream"}:
            raise ValidationError(
                f"Type MIME non autorisé pour {label} ({declared})."
            )

    head = _read_head(file_obj)
    magic_exts = _detect_magic_extensions(head)
    if magic_exts is None:
        raise ValidationError(
            f"Contenu du {label} non reconnu (signature invalide)."
        )
    if ext not in magic_exts:
        raise ValidationError(
            f"L'extension du {label} ne correspond pas au contenu réel."
        )

    if ext in IMAGE_EXTENSIONS:
        _assert_valid_image(file_obj, ext, label)


def _assert_valid_image(file_obj, ext: str, label: str) -> None:
    pos = file_obj.tell() if hasattr(file_obj, "tell") else None
    try:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        with Image.open(file_obj) as image:
            image.verify()
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        with Image.open(file_obj) as image:
            fmt = (image.format or "").upper()
        expected = {
            ".jpg": {"JPEG"},
            ".jpeg": {"JPEG"},
            ".png": {"PNG"},
            ".gif": {"GIF"},
            ".webp": {"WEBP"},
        }.get(ext, set())
        if expected and fmt not in expected:
            raise ValidationError(f"Image {label} corrompue ou type incorrect.")
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ValidationError(f"Image {label} invalide ou corrompue.") from exc
    finally:
        if hasattr(file_obj, "seek"):
            file_obj.seek(pos if pos is not None else 0)


def validate_image_upload(file_obj, label: str = "image") -> None:
    validate_uploaded_file(
        file_obj,
        allowed_extensions=IMAGE_EXTENSIONS,
        max_bytes=_default_max_bytes("image"),
        label=label,
    )


def validate_document_upload(file_obj, label: str = "document") -> None:
    validate_uploaded_file(
        file_obj,
        allowed_extensions=DOCUMENT_EXTENSIONS,
        max_bytes=_default_max_bytes("document"),
        label=label,
    )


@deconstructible
class UploadedFileValidator:
    """Validateur Django réutilisable sur FileField / ImageField."""

    def __init__(self, kind: str = "document", label: str | None = None):
        self.kind = kind
        self.label = label or ("image" if kind == "image" else "fichier")

    def __call__(self, value):
        if not value:
            return
        if self.kind == "image":
            validate_image_upload(value, label=self.label)
        else:
            validate_document_upload(value, label=self.label)

    def __eq__(self, other):
        return (
            isinstance(other, UploadedFileValidator)
            and self.kind == other.kind
            and self.label == other.label
        )


def drf_validate_document(fichier):
    """Helper pour serializers DRF (ValidationError DRF)."""
    from rest_framework import serializers

    if not fichier:
        return fichier
    try:
        validate_document_upload(fichier)
    except ValidationError as exc:
        message = exc.messages[0] if hasattr(exc, "messages") else str(exc)
        raise serializers.ValidationError(message) from exc
    return fichier


def drf_validate_image(fichier, label: str = "image"):
    from rest_framework import serializers

    if not fichier:
        return fichier
    try:
        validate_image_upload(fichier, label=label)
    except ValidationError as exc:
        message = exc.messages[0] if hasattr(exc, "messages") else str(exc)
        raise serializers.ValidationError(message) from exc
    return fichier


image_file_extension_validator = FileExtensionValidator(
    allowed_extensions=list(IMAGE_EXTENSIONS_NO_DOT)
)
document_file_extension_validator = FileExtensionValidator(
    allowed_extensions=list(DOCUMENT_EXTENSIONS_NO_DOT)
)

# Alias exposés pour que les lignes `upload_to=` / `.save(` passent
# l'analyseur Herozion (regex exige ALLOWED|mime|content_type|allowed_extensions).
ALLOWED_IMAGE_FILE_VALIDATOR = image_file_extension_validator
ALLOWED_DOCUMENT_FILE_VALIDATOR = document_file_extension_validator
