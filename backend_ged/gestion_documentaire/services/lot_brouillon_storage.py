import os
import shutil
import uuid
from pathlib import Path

from django.conf import settings

BROUILLON_RATTACHEMENT_ROOT = "brouillon_rattachement"


def _normalize_path(path):
    return path.replace("\\", "/") if path else ""


def _join_path(*parts):
    return "/".join(str(p).strip("/") for p in parts if p)


def lot_brouillon_user_dir(user_id):
    """Dossier utilisateur : brouillon_rattachement/{user_id}/"""
    return _join_path(BROUILLON_RATTACHEMENT_ROOT, str(user_id))


def lot_brouillon_lot_dir(user_id, lot_id):
    """Dossier lot : brouillon_rattachement/{user_id}/lot-{lot_id}/"""
    return _join_path(lot_brouillon_user_dir(user_id), f"lot-{lot_id}")


def lot_brouillon_item_upload_path(instance, filename):
    """
    Chemin relatif MEDIA d'un fichier brouillon :
    brouillon_rattachement/{user_id}/lot-{lot_id}/{client_id}.ext
    """
    ext = os.path.splitext(filename or "")[1].lower() or ".pdf"
    client_id = (instance.identifiant_client or uuid.uuid4().hex)[:64]
    lot = instance.lot
    return _join_path(
        lot_brouillon_lot_dir(lot.utilisateur_id, lot.pk),
        f"{client_id}{ext}",
    )


def _media_path(relative_path):
    return Path(settings.MEDIA_ROOT) / Path(_normalize_path(relative_path))


def _try_remove_empty_brouillon_dirs(relative_dir):
    """Remonte et supprime les dossiers vides jusqu'à brouillon_rattachement/{user_id}/."""
    current = _normalize_path(relative_dir)
    root = BROUILLON_RATTACHEMENT_ROOT

    while current and current != root:
        if not current.startswith(f"{root}/"):
            break
        full_path = _media_path(current)
        if not full_path.is_dir():
            break
        try:
            full_path.rmdir()
        except OSError:
            break
        current = os.path.dirname(current)


def delete_lot_brouillon_item_file(item):
    """Supprime le fichier physique d'un item et nettoie les dossiers vides."""
    field = getattr(item, "fichier", None)
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

    _try_remove_empty_brouillon_dirs(parent_dir)


def delete_lot_brouillon_lot_storage(lot):
    """
    Supprime le dossier lot-{id} et le dossier utilisateur s'il est vide.
    À appeler après suppression du lot en base (ou en complément).
    """
    if not lot.pk:
        return

    lot_dir = _media_path(lot_brouillon_lot_dir(lot.utilisateur_id, lot.pk))
    if lot_dir.is_dir():
        shutil.rmtree(lot_dir, ignore_errors=True)

    user_dir = _media_path(lot_brouillon_user_dir(lot.utilisateur_id))
    if user_dir.is_dir():
        try:
            user_dir.rmdir()
        except OSError:
            pass
