"""Prépare le fichier PDF courant d'un document pour téléchargement."""
from __future__ import annotations

import os

from gestion_documentaire.services.annotation_pdf_service import prepare_file_for_download
from gestion_documentaire.services.document_storage import download_display_filename


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
    content_type = "application/pdf"
    if not filename.lower().endswith(".pdf"):
        guessed = (document.fichier.name or "").lower()
        if guessed.endswith(".pdf"):
            content_type = "application/pdf"
        elif guessed.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif guessed.endswith(".png"):
            content_type = "image/png"

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
    content_type = "application/pdf"
    if not filename.lower().endswith(".pdf"):
        guessed = (version.fichier.name or "").lower()
        if guessed.endswith(".pdf"):
            content_type = "application/pdf"
        elif guessed.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif guessed.endswith(".png"):
            content_type = "image/png"

    return content, filename, content_type
