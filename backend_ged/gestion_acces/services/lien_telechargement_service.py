"""Téléchargement via lien temporaire (fichier unique ou archive)."""
import os
from datetime import datetime

from django.http import FileResponse, HttpResponse

from gestion_documentaire.models import DocumentLocalite
from gestion_documentaire.services.archive_service import build_documents_archive
from gestion_documentaire.services.document_storage import download_display_filename

FORMAT_LABELS = {
    "pdf": "PDF",
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "gif": "GIF",
}


def _safe_filename(name: str) -> str:
    return (name or "document").replace('"', "")


def _file_format_label(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower().lstrip(".")
    if not ext:
        return "—"
    return FORMAT_LABELS.get(ext, ext.upper())


def build_document_summary(doc) -> dict:
    """Résumé d'un document pour l'affichage dans la liste des liens."""
    raw = os.path.basename(doc.fichier.name) if doc.fichier and doc.fichier.name else ""
    filename = download_display_filename(raw) if raw else ""
    localite_label = doc.localite.libelle if getattr(doc, "localite", None) else "—"
    type_label = doc.type_document.libelle if getattr(doc, "type_document", None) else "—"
    has_file = _document_has_file(doc)
    return {
        "id": doc.id,
        "type_document_libelle": type_label,
        "localite_libelle": localite_label,
        "format": _file_format_label(filename),
        "fichier_nom": filename or None,
        "date_creation": doc.date_creation.isoformat() if doc.date_creation else None,
        "is_available": has_file,
    }


def build_documents_summaries_map(document_ids):
    """Map id → résumé pour une liste d'identifiants de documents."""
    docs = resolve_documents_for_link(document_ids)
    by_id = {doc.id: build_document_summary(doc) for doc in docs}
    ordered = []
    for doc_id in document_ids or []:
        if doc_id in by_id:
            ordered.append(by_id[doc_id])
        else:
            ordered.append(
                {
                    "id": doc_id,
                    "type_document_libelle": "—",
                    "localite_libelle": "—",
                    "format": "—",
                    "fichier_nom": None,
                    "date_creation": None,
                    "is_available": False,
                }
            )
    return ordered


def build_download_response(documents):
    """
    Retourne une HttpResponse pour 1 document (fichier direct) ou plusieurs (archive RAR/ZIP).
    """
    if not documents:
        raise ValueError("Aucun document disponible.")

    if len(documents) == 1:
        doc = documents[0]
        if not doc.fichier:
            raise ValueError("Fichier introuvable.")
        filename = _safe_filename(
            download_display_filename(
                os.path.basename(doc.fichier.name),
                fallback=f"document-{doc.pk}",
            )
        )
        content_type = "application/octet-stream"
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".pdf":
            content_type = "application/pdf"
        return FileResponse(doc.fichier.open("rb"), as_attachment=True, filename=filename, content_type=content_type)

    content, ext = build_documents_archive(documents)
    stamp = datetime.now().strftime("%Y-%m-%d")
    filename = f"documents-{stamp}{ext}"
    content_type = "application/x-rar-compressed" if ext == ".rar" else "application/zip"
    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
    response["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type"
    return response


def resolve_documents_for_link(document_ids):
    """Charge les documents encore présents en base pour un lien."""
    if not document_ids:
        return []
    return list(
        DocumentLocalite.objects.filter(id__in=document_ids)
        .select_related("type_document", "localite")
        .order_by("id")
    )


def _document_has_file(doc) -> bool:
    if not doc.fichier:
        return False
    try:
        path = doc.fichier.path
    except (ValueError, AttributeError):
        return False
    return bool(path and os.path.isfile(path))


def get_downloadable_documents(document_ids):
    """Documents encore téléchargeables (présents en base + fichier sur disque)."""
    return [doc for doc in resolve_documents_for_link(document_ids) if _document_has_file(doc)]


def get_link_document_availability(document_ids):
    ids = list(document_ids or [])
    total = len(ids)
    if not total:
        return {
            "total": 0,
            "found": 0,
            "downloadable": 0,
            "missing": 0,
        }

    docs = resolve_documents_for_link(ids)
    found = len(docs)
    downloadable = sum(1 for doc in docs if _document_has_file(doc))
    return {
        "total": total,
        "found": found,
        "downloadable": downloadable,
        "missing": total - downloadable,
    }
