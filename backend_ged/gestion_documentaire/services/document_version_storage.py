import os
import uuid

from django.utils import timezone
from django.utils.text import slugify

from gestion_documentaire.services.document_storage import (
    VERSIONS_ROOT,
    _join_path,
    _normalize_path,
    _resolve_localite,
    _try_remove_empty_parent_dirs,
    build_localite_folder_path,
    parse_year_month_from_path,
)

FILENAME_BASE_MAX_LEN = 80


def _resolve_document(version):
    document = getattr(version, "document", None)
    if document is not None:
        return document
    document_id = getattr(version, "document_id", None)
    if not document_id:
        return None
    from gestion_documentaire.models import DocumentLocalite

    return (
        DocumentLocalite.objects.filter(pk=document_id)
        .select_related("localite")
        .first()
    )


def _year_month_for_version(version, document):
    """Année/mois identiques au document courant (plan de classement)."""
    sources = []
    if document is not None and getattr(document, "fichier", None) and document.fichier.name:
        sources.append(document.fichier.name)
    if version is not None and getattr(version, "fichier", None) and version.fichier.name:
        sources.append(version.fichier.name)
    for path in sources:
        year, month = parse_year_month_from_path(path)
        if year:
            return year, month
    for dt in (
        getattr(document, "date_creation", None),
        getattr(version, "date_creation", None),
    ):
        if dt:
            return dt.strftime("%Y"), dt.strftime("%m")
    now = timezone.now()
    return now.strftime("%Y"), now.strftime("%m")


def build_document_version_file_path(version, filename=None):
    """
    Même arborescence que l'archive, avec un dossier de version :
    versions_document/{parents...}/{feuille}/{année}/{mois}/v{N}/{fichier}
    """
    document = _resolve_document(version)
    filename = filename or os.path.basename(
        _normalize_path(getattr(getattr(version, "fichier", None), "name", "") or "")
    ) or "document"
    year, month = _year_month_for_version(version, document)
    version_folder = f"v{version.version_number or 1}"
    localite = _resolve_localite(document) if document is not None else None
    if localite is None:
        return _join_path(VERSIONS_ROOT, "non_classes", version_folder, filename)
    folder = build_localite_folder_path(localite, year, month, root=VERSIONS_ROOT)
    return _join_path(folder, version_folder, filename)


def document_version_upload_path(instance, filename):
    """Chemin de stockage d'une nouvelle version (plan de classement + vN)."""
    base, ext = os.path.splitext(filename or "document")
    safe = slugify(base)[:FILENAME_BASE_MAX_LEN] or "document"
    ext = ext.lower() if ext else ".pdf"
    unique = uuid.uuid4().hex[:8]
    return build_document_version_file_path(instance, filename=f"{safe}_{unique}{ext}")


def relocate_document_version_file(version):
    """
    Déplace le fichier d'une version vers l'arborescence du plan de classement
    et met à jour le chemin en base.
    """
    from gestion_documentaire.models import DocumentVersion

    if not version.fichier or not version.fichier.name:
        return False

    old_name = _normalize_path(version.fichier.name)
    new_name = build_document_version_file_path(version)
    if old_name == new_name:
        return False

    storage = version.fichier.storage
    if not storage.exists(old_name):
        return False

    with storage.open(old_name, "rb") as source:
        storage.save(new_name, source)  # ALLOWED — internal relocate, same mime
    storage.delete(old_name)
    _try_remove_empty_parent_dirs(os.path.dirname(old_name))

    DocumentVersion.objects.filter(pk=version.pk).update(fichier=new_name)
    version.fichier.name = new_name
    return True
