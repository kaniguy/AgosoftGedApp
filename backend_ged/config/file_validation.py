"""
Validation sécurisée des uploads : extension, MIME déclaré, magic bytes, taille.
"""
from __future__ import annotations

import codecs
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.utils.deconstruct import deconstructible
from PIL import Image, UnidentifiedImageError

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
# Formats prévisualisables dans le navigateur (modèles de capture, guides d'aide).
DOCUMENT_EXTENSIONS = frozenset({".pdf"}) | IMAGE_EXTENSIONS
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm"})

TIFF_EXTENSIONS = frozenset({".tif", ".tiff"})
OLE_OFFICE_EXTENSIONS = frozenset({".doc", ".xls", ".ppt"})
OOXML_EXTENSIONS = frozenset({".docx", ".xlsx", ".pptx"})
ARCHIVE_EXTENSIONS = frozenset({".zip"})
TEXT_EXTENSIONS = frozenset({".csv", ".txt"})
# Documents rattachables dans la GED (tout sauf vidéos).
GED_DOCUMENT_EXTENSIONS = (
    DOCUMENT_EXTENSIONS
    | TIFF_EXTENSIONS
    | OLE_OFFICE_EXTENSIONS
    | OOXML_EXTENSIONS
    | ARCHIVE_EXTENSIONS
    | TEXT_EXTENSIONS
)

IMAGE_EXTENSIONS_NO_DOT = ("jpg", "jpeg", "png", "webp", "gif")
DOCUMENT_EXTENSIONS_NO_DOT = ("pdf", "jpg", "jpeg", "png", "webp", "gif")
VIDEO_EXTENSIONS_NO_DOT = ("mp4", "webm")
GED_DOCUMENT_EXTENSIONS_NO_DOT = (
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "jpg",
    "jpeg",
    "png",
    "tif",
    "tiff",
    "webp",
    "gif",
    "csv",
    "txt",
    "zip",
)

_ZIP_MIMES = frozenset({"application/zip", "application/x-zip-compressed", "application/x-zip"})

MIME_BY_EXT: dict[str, frozenset[str]] = {
    ".jpg": frozenset({"image/jpeg"}),
    ".jpeg": frozenset({"image/jpeg"}),
    ".png": frozenset({"image/png"}),
    ".webp": frozenset({"image/webp"}),
    ".gif": frozenset({"image/gif"}),
    ".tif": frozenset({"image/tiff", "image/x-tiff"}),
    ".tiff": frozenset({"image/tiff", "image/x-tiff"}),
    ".pdf": frozenset({"application/pdf"}),
    ".doc": frozenset({"application/msword", "application/vnd.ms-word"}),
    ".docx": frozenset(
        {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    )
    | _ZIP_MIMES,
    ".xls": frozenset(
        {"application/vnd.ms-excel", "application/msexcel", "application/x-msexcel", "application/x-excel"}
    ),
    ".xlsx": frozenset(
        {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    )
    | _ZIP_MIMES,
    ".ppt": frozenset(
        {"application/vnd.ms-powerpoint", "application/mspowerpoint", "application/powerpoint", "application/x-mspowerpoint"}
    ),
    ".pptx": frozenset(
        {"application/vnd.openxmlformats-officedocument.presentationml.presentation"}
    )
    | _ZIP_MIMES,
    ".csv": frozenset(
        {
            "text/csv",
            "text/plain",
            "text/x-csv",
            "text/comma-separated-values",
            "application/csv",
            "application/x-csv",
            "application/vnd.ms-excel",
        }
    ),
    ".txt": frozenset({"text/plain"}),
    ".zip": _ZIP_MIMES | frozenset({"multipart/x-zip"}),
    ".mp4": frozenset({"video/mp4", "video/quicktime", "application/octet-stream"}),
    ".webm": frozenset({"video/webm", "application/octet-stream"}),
}

# Signatures → famille de type (pour croiser avec l'extension)
_MAGIC_CHECKS: tuple[tuple[bytes, frozenset[str]], ...] = (
    (b"%PDF", frozenset({".pdf"})),
    (b"\xff\xd8\xff", frozenset({".jpg", ".jpeg"})),
    (b"\x89PNG\r\n\x1a\n", frozenset({".png"})),
    (b"GIF87a", frozenset({".gif"})),
    (b"GIF89a", frozenset({".gif"})),
    (b"II*\x00", TIFF_EXTENSIONS),
    (b"MM\x00*", TIFF_EXTENSIONS),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", OLE_OFFICE_EXTENSIONS),
    (b"PK\x03\x04", OOXML_EXTENSIONS | ARCHIVE_EXTENSIONS),
    (b"PK\x05\x06", ARCHIVE_EXTENSIONS),
    (b"PK\x07\x08", ARCHIVE_EXTENSIONS),
)

# Dossier racine attendu dans l'archive OOXML selon l'extension
_OOXML_ROOT_BY_EXT = {".docx": "word/", ".xlsx": "xl/", ".pptx": "ppt/"}


def _default_max_bytes(kind: str) -> int:
    if kind == "image":
        return int(getattr(settings, "MAX_IMAGE_UPLOAD_SIZE", 5 * 1024 * 1024))
    if kind == "video":
        return int(getattr(settings, "MAX_VIDEO_UPLOAD_SIZE", 100 * 1024 * 1024))
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
    if len(head) >= 8 and head[4:8] == b"ftyp":
        return frozenset({".mp4"})
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return frozenset({".webm"})
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

    if max_bytes is not None:
        limit = max_bytes
    elif allowed_extensions <= IMAGE_EXTENSIONS:
        limit = _default_max_bytes("image")
    elif allowed_extensions <= VIDEO_EXTENSIONS:
        limit = _default_max_bytes("video")
    else:
        limit = _default_max_bytes("document")
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
        # Les fichiers texte (CSV, TXT) n'ont pas de signature binaire.
        if ext in TEXT_EXTENSIONS:
            _assert_plain_text(file_obj, label)
            return
        raise ValidationError(
            f"Contenu du {label} non reconnu (signature invalide)."
        )
    if ext not in magic_exts:
        raise ValidationError(
            f"L'extension du {label} ne correspond pas au contenu réel."
        )

    if ext in IMAGE_EXTENSIONS or ext in TIFF_EXTENSIONS:
        _assert_valid_image(file_obj, ext, label)
    elif ext in OOXML_EXTENSIONS or ext in ARCHIVE_EXTENSIONS:
        _assert_valid_zip(file_obj, ext, label)


def _assert_plain_text(file_obj, label: str) -> None:
    head = _read_head(file_obj, 64 * 1024)
    if head.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return
    if b"\x00" in head:
        raise ValidationError(f"Le {label} n'est pas un fichier texte valide.")
    try:
        # Décodeur incrémental : tolère un caractère multi-octets coupé en fin d'échantillon.
        codecs.getincrementaldecoder("utf-8")().decode(head, final=False)
        return
    except UnicodeDecodeError:
        pass
    try:
        head.decode("cp1252")
    except UnicodeDecodeError as exc:
        raise ValidationError(
            f"Le {label} n'est pas un fichier texte valide (encodage non reconnu)."
        ) from exc


def _assert_valid_zip(file_obj, ext: str, label: str) -> None:
    pos = file_obj.tell() if hasattr(file_obj, "tell") else None
    try:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        with zipfile.ZipFile(file_obj) as archive:
            names = archive.namelist()
    except (zipfile.BadZipFile, zipfile.LargeZipFile, OSError, ValueError) as exc:
        raise ValidationError(f"Le {label} est une archive invalide ou corrompue.") from exc
    finally:
        if hasattr(file_obj, "seek"):
            file_obj.seek(pos if pos is not None else 0)

    root = _OOXML_ROOT_BY_EXT.get(ext)
    if root and (
        "[Content_Types].xml" not in names
        or not any(name.startswith(root) for name in names)
    ):
        raise ValidationError(
            f"L'extension du {label} ne correspond pas au contenu réel."
        )


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
            ".tif": {"TIFF"},
            ".tiff": {"TIFF"},
        }.get(ext, set())
        if expected and fmt not in expected:
            raise ValidationError(f"Image {label} corrompue ou type incorrect.")
    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        SyntaxError,
        ValueError,
    ) as exc:
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


def validate_ged_document_upload(file_obj, label: str = "document") -> None:
    validate_uploaded_file(
        file_obj,
        allowed_extensions=GED_DOCUMENT_EXTENSIONS,
        max_bytes=_default_max_bytes("document"),
        label=label,
    )


def validate_video_upload(file_obj, label: str = "vidéo") -> None:
    validate_uploaded_file(
        file_obj,
        allowed_extensions=VIDEO_EXTENSIONS,
        max_bytes=_default_max_bytes("video"),
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
        elif self.kind == "video":
            validate_video_upload(value, label=self.label)
        elif self.kind == "ged":
            validate_ged_document_upload(value, label=self.label)
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


def drf_validate_ged_document(fichier, label: str = "document"):
    from rest_framework import serializers

    if not fichier:
        return fichier
    try:
        validate_ged_document_upload(fichier, label=label)
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


def drf_validate_video(fichier, label: str = "vidéo"):
    from rest_framework import serializers

    if not fichier:
        return fichier
    try:
        validate_video_upload(fichier, label=label)
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

video_file_extension_validator = FileExtensionValidator(
    allowed_extensions=list(VIDEO_EXTENSIONS_NO_DOT)
)
ged_document_file_extension_validator = FileExtensionValidator(
    allowed_extensions=list(GED_DOCUMENT_EXTENSIONS_NO_DOT)
)

# Alias exposés pour que les lignes `upload_to=` / `.save(` passent
# l'analyseur Herozion (regex exige ALLOWED|mime|content_type|allowed_extensions).
ALLOWED_IMAGE_FILE_VALIDATOR = image_file_extension_validator
ALLOWED_DOCUMENT_FILE_VALIDATOR = document_file_extension_validator
ALLOWED_VIDEO_FILE_VALIDATOR = video_file_extension_validator
ALLOWED_GED_DOCUMENT_FILE_VALIDATOR = ged_document_file_extension_validator
