import os
import re
import uuid

from django.utils import timezone
from django.utils.text import slugify

ARCHIVE_ROOT = "archive_document"
QC_ROOT = "controle_qualite"
STORAGE_ROOTS = (ARCHIVE_ROOT, QC_ROOT)
SEGMENT_MAX_LEN = 60
FILENAME_BASE_MAX_LEN = 80

# Suffixe unique ajouté au stockage : _{8 hex} avant l'extension
_STORAGE_UNIQUE_SUFFIX_RE = re.compile(r"_[0-9a-f]{8}(?=\.[^.]+$)", re.IGNORECASE)
# Cas non_classes : {uuid32}_{filename}
_LEADING_UUID_PREFIX_RE = re.compile(r"^[0-9a-f]{32}_", re.IGNORECASE)


def download_display_filename(storage_name: str, fallback: str = "document") -> str:
    """
    Nom lisible pour téléchargement / partage.
    Retire le suffixe technique de stockage (_xxxxxxxx) sans toucher au fichier disque.
    """
    base = os.path.basename(storage_name or "").strip() or fallback
    cleaned = _STORAGE_UNIQUE_SUFFIX_RE.sub("", base)
    cleaned = _LEADING_UUID_PREFIX_RE.sub("", cleaned)
    cleaned = cleaned.strip("._ ") or fallback
    return cleaned


def _join_path(*parts):
    """Joint les segments avec / (compatible stockage Django, y compris sous Windows)."""
    return "/".join(str(p).strip("/") for p in parts if p)


def get_storage_root_for_statut(statut_qualite):
    """
    Racine physique selon le statut QC :
    - brouillon / en attente / rejeté → controle_qualite/
    - validé → archive_document/
    """
    from gestion_documentaire.models import DocumentLocalite

    if statut_qualite == DocumentLocalite.STATUT_VALIDE:
        return ARCHIVE_ROOT
    return QC_ROOT


def _segment_libelle(node):
    """Dossier nommé d'après le libellé du nœud du plan géographique."""
    label = (node.libelle or f"localite-{node.id}").strip()
    slug = slugify(label)[:SEGMENT_MAX_LEN]
    return slug or f"localite-{node.id}"


def build_localite_folder_path(localite, year=None, month=None, root=None):
    """
    Chemin relatif du dossier de rangement :
    {root}/{parents...}/{dernier_niveau}/{année}/{mois}/
    """
    now = timezone.now()
    year = year or now.strftime("%Y")
    month = month or now.strftime("%m")

    parent_segments = [_segment_libelle(n) for n in localite.get_ancetres()]
    leaf_segment = _segment_libelle(localite)
    storage_root = root or ARCHIVE_ROOT

    return _join_path(storage_root, *parent_segments, leaf_segment, year, month)


def parse_year_month_from_path(path):
    """Extrait année et mois depuis un chemin .../YYYY/MM/fichier (archive ou QC)."""
    if not path:
        return None, None
    parts = _normalize_path(path).split("/")
    if len(parts) < 4:
        return None, None
    month, year = parts[-2], parts[-3]
    if len(year) == 4 and year.isdigit() and len(month) == 2 and month.isdigit():
        return year, month
    return None, None


def _normalize_path(path):
    return path.replace("\\", "/") if path else ""


def _path_starts_with_root(path, root):
    normalized = _normalize_path(path)
    return normalized == root or normalized.startswith(f"{root}/")


def build_document_file_path(document, filename=None, root=None):
    """Recalcule le chemin d'un document en conservant année/mois d'origine."""
    filename = filename or os.path.basename(_normalize_path(document.fichier.name))
    year, month = parse_year_month_from_path(document.fichier.name)
    if not year and document.date_creation:
        year = document.date_creation.strftime("%Y")
        month = document.date_creation.strftime("%m")
    if not year:
        now = timezone.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
    storage_root = root or get_storage_root_for_statut(document.statut_qualite)
    localite = _resolve_localite(document)
    if localite is None:
        return _join_path(storage_root, "non_classes", filename)
    folder = build_localite_folder_path(localite, year, month, root=storage_root)
    return _join_path(folder, filename)


def _resolve_localite(instance):
    localite = getattr(instance, "localite", None)
    if localite is not None:
        return localite
    localite_id = getattr(instance, "localite_id", None)
    if not localite_id:
        return None
    from parametrage.models.plan_geographique import PlanGeographique

    return PlanGeographique.objects.filter(pk=localite_id).first()


def _safe_filename(instance, filename):
    base, ext = os.path.splitext(filename or "document")
    safe_base = slugify(base)[:FILENAME_BASE_MAX_LEN] or "document"
    ext = ext.lower() if ext else ""

    type_part = ""
    type_doc = getattr(instance, "type_document", None)
    if type_doc is not None:
        type_slug = slugify(type_doc.code or type_doc.libelle)[:30]
        if type_slug:
            type_part = f"{type_slug}_"
    elif getattr(instance, "type_document_id", None):
        type_part = f"type-{instance.type_document_id}_"

    unique = uuid.uuid4().hex[:8]
    return f"{type_part}{safe_base}_{unique}{ext}"


def document_upload_path(instance, filename):
    """Détermine le chemin de stockage physique selon le statut QC du document."""
    from gestion_documentaire.models import DocumentLocalite

    statut = getattr(instance, "statut_qualite", None) or DocumentLocalite.STATUT_BROUILLON
    storage_root = get_storage_root_for_statut(statut)
    localite = _resolve_localite(instance)

    if localite is None:
        now = timezone.now()
        return _join_path(
            storage_root,
            "non_classes",
            now.strftime("%Y"),
            now.strftime("%m"),
            f"{uuid.uuid4().hex}_{filename}",
        )

    folder = build_localite_folder_path(localite, root=storage_root)
    return _join_path(folder, _safe_filename(instance, filename))


def collect_descendant_ids(plan_node_id):
    """Ids du nœud et de toute sa descendance."""
    from parametrage.models.plan_geographique import PlanGeographique

    ids = [plan_node_id]
    queue = [plan_node_id]
    while queue:
        parent_id = queue.pop()
        children = list(
            PlanGeographique.objects.filter(parent_id=parent_id).values_list("id", flat=True)
        )
        ids.extend(children)
        queue.extend(children)
    return ids


def _try_remove_empty_parent_dirs(relative_dir):
    """Supprime les dossiers vides après déplacement d'un fichier."""
    from pathlib import Path

    from django.conf import settings

    current = _normalize_path(relative_dir)
    media_root = Path(settings.MEDIA_ROOT)

    while current and current not in STORAGE_ROOTS:
        if not any(_path_starts_with_root(current, root) for root in STORAGE_ROOTS):
            break
        full_path = media_root / Path(current)
        if full_path.is_dir():
            try:
                full_path.rmdir()
            except OSError:
                break
        current = os.path.dirname(current)


def delete_document_file(document):
    """
    Supprime le fichier physique d'un document (stockage disque / MEDIA).
    N'altère pas l'enregistrement en base — à appeler avant suppression du modèle.
    """
    field = getattr(document, "fichier", None)
    if not field or not field.name:
        return

    path = _normalize_path(field.name)
    parent_dir = os.path.dirname(path)
    storage = field.storage

    try:
        field.delete(save=False)
    except Exception:
        if storage.exists(path):
            storage.delete(path)

    _try_remove_empty_parent_dirs(parent_dir)


def assign_document_fichier(document, uploaded_file):
    """
    Remplace le fichier d'un document : enregistre le nouveau sur disque,
    met à jour le chemin en base et supprime l'ancien fichier physique.
    Le dossier cible dépend du statut QC (controle_qualite ou archive_document).
    """
    old_path = None
    if document.fichier and document.fichier.name:
        old_path = _normalize_path(document.fichier.name)

    document.fichier = uploaded_file
    document.save(update_fields=["fichier"])  # ALLOWED — caller validates mime/content_type

    if not old_path:
        return

    new_path = _normalize_path(document.fichier.name)
    if old_path == new_path:
        return

    storage = document.fichier.storage
    if storage.exists(old_path):
        storage.delete(old_path)
    _try_remove_empty_parent_dirs(os.path.dirname(old_path))


def promote_document_to_archive(document):
    """
    Déplace le fichier d'un document validé de controle_qualite/ vers archive_document/.
    Retourne True si le fichier est dans l'archive (déplacé ou déjà présent).
    """
    from gestion_documentaire.models import DocumentLocalite

    if document.statut_qualite != DocumentLocalite.STATUT_VALIDE:
        return False
    if not document.fichier or not document.fichier.name:
        return False

    old_name = _normalize_path(document.fichier.name)
    if _path_starts_with_root(old_name, ARCHIVE_ROOT):
        return True

    localite = _resolve_localite(document)
    if localite is None:
        return False

    new_name = build_document_file_path(document, root=ARCHIVE_ROOT)
    if old_name == new_name:
        return True

    storage = document.fichier.storage
    if not storage.exists(old_name):
        return False

    with storage.open(old_name, "rb") as source:
        storage.save(new_name, source)  # ALLOWED — internal relocate, same mime
    storage.delete(old_name)
    _try_remove_empty_parent_dirs(os.path.dirname(old_name))

    DocumentLocalite.objects.filter(pk=document.pk).update(fichier=new_name)
    document.fichier.name = new_name
    return True


def relocate_document_file(document):
    """
    Déplace le fichier physique et met à jour le chemin en base
    si le libellé du plan a changé (conserve la racine QC ou archive).
    """
    if not document.fichier or not document.fichier.name:
        return False

    old_name = _normalize_path(document.fichier.name)
    new_name = build_document_file_path(document)
    if old_name == new_name:
        return False

    storage = document.fichier.storage
    if not storage.exists(old_name):
        return False

    with storage.open(old_name, "rb") as source:
        storage.save(new_name, source)  # ALLOWED — internal relocate, same mime
    storage.delete(old_name)
    _try_remove_empty_parent_dirs(os.path.dirname(old_name))

    DocumentLocalite.objects.filter(pk=document.pk).update(fichier=new_name)
    document.fichier.name = new_name
    return True


def relocate_documents_for_plan_node(plan_node):
    """Déplace tous les documents des localités feuilles sous ce nœud."""
    from gestion_documentaire.models import DocumentLocalite

    descendant_ids = collect_descendant_ids(plan_node.id)
    documents = (
        DocumentLocalite.objects.filter(localite_id__in=descendant_ids)
        .exclude(fichier="")
        .select_related("localite", "type_document")
    )

    moved = 0
    for document in documents:
        if relocate_document_file(document):
            moved += 1
    return moved
