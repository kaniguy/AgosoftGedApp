"""Prépare le fichier courant d'un document pour téléchargement."""
from __future__ import annotations

import os

from gestion_documentaire.services.annotation_pdf_service import prepare_file_for_download
from gestion_documentaire.services.document_storage import download_display_filename

CONTENT_TYPE_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".zip": "application/zip",
}


def guess_document_content_type(*names: str, content: bytes | None = None) -> str:
    """Type MIME d'après l'extension du premier nom reconnu, sinon d'après la signature PDF."""
    for name in names:
        ext = os.path.splitext((name or "").lower())[1]
        if ext in CONTENT_TYPE_BY_EXTENSION:
            return CONTENT_TYPE_BY_EXTENSION[ext]
    if content and content[:4] == b"%PDF":
        return "application/pdf"
    return "application/octet-stream"


def get_document_download_payload(document) -> tuple[bytes, str, str]:
    """
    Lit le fichier courant en base et y fusionne les annotations si besoin.

    Returns:
        (contenu_bytes, nom_fichier, content_type)
    """
    if not document.fichier or not document.fichier.name:
        raise FileNotFoundError("Fichier indisponible.")

    with document.fichier.open("rb") as handle:
        content = handle.read()

    annotations = list(document.annotations or [])
    raw_name = os.path.basename(document.fichier.name) or f"document-{document.pk}.pdf"
    filename = download_display_filename(raw_name, fallback=f"document-{document.pk}.pdf")
    content = prepare_file_for_download(content, annotations, filename=filename)
    content_type = guess_document_content_type(filename, document.fichier.name, content=content)

    return content, filename, content_type


def get_archived_version_download_payload(version) -> tuple[bytes, str, str]:
    """Lit une version archivée et y fusionne ses annotations si besoin."""
    if not version.fichier or not version.fichier.name:
        raise FileNotFoundError("Fichier indisponible.")

    with version.fichier.open("rb") as handle:
        content = handle.read()

    annotations = list(version.annotations or [])
    raw_name = (
        os.path.basename(version.fichier.name)
        or f"document-{version.document_id}-v{version.version_number}.pdf"
    )
    filename = download_display_filename(
        raw_name,
        fallback=f"document-{version.document_id}-v{version.version_number}.pdf",
    )
    content = prepare_file_for_download(content, annotations, filename=filename)
    content_type = guess_document_content_type(filename, version.fichier.name, content=content)

    return content, filename, content_type
