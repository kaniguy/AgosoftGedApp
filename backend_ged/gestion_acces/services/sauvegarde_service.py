"""Export, restauration et réinitialisation (données Django + dossier media)."""

from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
import threading
import zipfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.management import call_command

BACKUP_FORMAT = "GEDBACKUP1"
CONFIRM_RESTORE = "RESTAURER"
CONFIRM_RESET = "REINITIALISER"

DUMP_ARGS = (
    "auth.group",
    "auth.user",
    "parametrage",
    "gestion_acces",
    "gestion_documentaire",
)
DUMP_EXCLUDE = (
    "contenttypes",
    "auth.permission",
    "admin",
    "sessions",
    "authtoken",
    "gestion_acces.sauvegardebase",
)

_lock = threading.Lock()
logger = logging.getLogger(__name__)


@contextmanager
def _silence_restore_signals():
    """Évite les profils auto-créés pendant loaddata (sinon UNIQUE sur SQL Server)."""
    from django.contrib.auth.models import Group, User
    from django.db.models.signals import post_save

    from gestion_acces.models.group_profile import create_group_profile
    from gestion_acces.models.user_profile import create_user_profile, save_user_profile

    pairs = (
        (create_user_profile, User),
        (save_user_profile, User),
        (create_group_profile, Group),
    )
    for receiver, sender in pairs:
        post_save.disconnect(receiver, sender=sender)
    try:
        yield
    finally:
        for receiver, sender in pairs:
            post_save.connect(receiver, sender=sender)


class SauvegardeError(Exception):
    """Erreur métier de sauvegarde."""


def _media_root() -> Path:
    return Path(settings.MEDIA_ROOT)


def _max_backup_bytes() -> int:
    return int(os.environ.get("MAX_BACKUP_UPLOAD_SIZE", str(2 * 1024 * 1024 * 1024)))


def media_stats():
    root = _media_root()
    total = 0
    count = 0
    if root.is_dir():
        for path in root.rglob("*"):
            if path.is_file():
                count += 1
                try:
                    total += path.stat().st_size
                except OSError:
                    pass
    return {"fichier_count": count, "taille_octets": total}


def _notify(progress, stage: str, percent: int, message: str):
    if progress:
        progress(stage, percent, message)


def _dump_data_to(path: Path):
    with path.open("w", encoding="utf-8") as fh:
        call_command(
            "dumpdata",
            *DUMP_ARGS,
            stdout=fh,
            natural_foreign=True,
            exclude=list(DUMP_EXCLUDE),
            verbosity=0,
        )


def build_backup_zip(progress=None) -> tuple[str, str]:
    """Crée un zip temporaire. Retourne (chemin, nom_fichier)."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"ged-sauvegarde-{stamp}.zip"
    fd, zip_path = tempfile.mkstemp(prefix="ged-backup-", suffix=".zip")
    os.close(fd)

    tmpdir = Path(tempfile.mkdtemp(prefix="ged-backup-data-"))
    try:
        _notify(progress, "dump", 8, "Export des données SQL…")
        data_path = tmpdir / "data.json"
        _dump_data_to(data_path)
        _notify(progress, "dump", 35, "Données SQL exportées.")

        media = _media_root()
        media_files = []
        media_bytes = 0
        if media.is_dir():
            _notify(progress, "archive", 40, "Inventaire des fichiers media…")
            for file_path in media.rglob("*"):
                if not file_path.is_file():
                    continue
                media_files.append(file_path)
                try:
                    media_bytes += file_path.stat().st_size
                except OSError:
                    pass

        manifest = {
            "format": BACKUP_FORMAT,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "db_name": settings.DATABASES["default"].get("NAME", ""),
            "media_included": True,
            "media_fichier_count": len(media_files),
            "media_taille_octets": media_bytes,
        }
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            zf.write(data_path, "data.json")
            total = len(media_files)
            for index, file_path in enumerate(media_files, 1):
                rel = file_path.relative_to(media).as_posix()
                zf.write(file_path, f"media/{rel}")
                if index == total or index == 1 or index % 8 == 0:
                    pct = 45 + int(40 * index / max(total, 1))
                    _notify(
                        progress,
                        "archive",
                        pct,
                        f"Compression des fichiers {index}/{total}…",
                    )
        _notify(progress, "ready", 90, "Archive prête.")
    except Exception:
        try:
            os.unlink(zip_path)
        except OSError:
            pass
        raise
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return zip_path, filename


def _validate_zip(archive: zipfile.ZipFile, dest: Path):
    dest = dest.resolve()
    uncompressed = 0
    max_bytes = _max_backup_bytes()
    for info in archive.infolist():
        uncompressed += info.file_size
        if uncompressed > max_bytes:
            raise SauvegardeError("Archive trop volumineuse.")
        name = info.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/"):
            raise SauvegardeError("Archive invalide.")
        target = (dest / name).resolve()
        if not str(target).startswith(str(dest)):
            raise SauvegardeError("Archive invalide.")


def _read_manifest(archive: zipfile.ZipFile) -> dict:
    try:
        raw = archive.read("manifest.json")
        data = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise SauvegardeError("Fichier de sauvegarde GED introuvable dans l'archive.") from exc
    if data.get("format") != BACKUP_FORMAT:
        raise SauvegardeError("Format de sauvegarde non reconnu.")
    if "data.json" not in archive.namelist():
        raise SauvegardeError("Données manquantes dans l'archive.")
    return data


def _empty_media():
    root = _media_root()
    root.mkdir(parents=True, exist_ok=True)
    for child in root.iterdir():
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            try:
                child.unlink()
            except OSError:
                pass


def _restore_media(extracted: Path):
    src = extracted / "media"
    _empty_media()
    if src.is_dir():
        shutil.copytree(src, _media_root(), dirs_exist_ok=True)


def _serialize_keep_users(user_ids):
    from gestion_acces.models.user_profile import UserProfile

    User = get_user_model()
    users = list(User.objects.filter(pk__in=user_ids))
    profiles = list(UserProfile.objects.filter(user_id__in=user_ids))
    return serializers.serialize("json", users + profiles)


def _reload_users(payload: str):
    if not payload:
        return
    with _silence_restore_signals():
        for obj in serializers.deserialize("json", payload):
            obj.save()


PERMISSION_M2M_FIELDS = ("permissions", "user_permissions")


def _prepare_fixture(data_file: Path) -> tuple[Path, int]:
    """
    Retire de la sauvegarde ce que la version installée ne connaît pas (modèles,
    champs ou permissions supprimés / pas encore créés). Retourne (fichier, nb ignorés).
    À appeler après le flush : les permissions viennent d'être recréées par post_migrate.
    """
    from django.apps import apps
    from django.contrib.auth.models import Permission

    with data_file.open(encoding="utf-8") as fh:
        objects = json.load(fh)

    known_perms = {
        tuple(key)
        for key in Permission.objects.values_list(
            "codename", "content_type__app_label", "content_type__model"
        )
    }
    field_names_cache = {}
    kept = []
    ignored = 0
    for obj in objects:
        label = obj.get("model") or ""
        try:
            model = apps.get_model(label)
        except (LookupError, ValueError):
            ignored += 1
            continue
        if label not in field_names_cache:
            meta = model._meta
            field_names_cache[label] = {
                f.name for f in [*meta.concrete_fields, *meta.many_to_many]
            }
        allowed = field_names_cache[label]
        fields = {k: v for k, v in (obj.get("fields") or {}).items() if k in allowed}
        for perm_field in PERMISSION_M2M_FIELDS:
            values = fields.get(perm_field)
            if isinstance(values, list):
                fields[perm_field] = [
                    v for v in values if not isinstance(v, list) or tuple(v) in known_perms
                ]
        obj["fields"] = fields
        kept.append(obj)

    cleaned = data_file.with_name("data.cleaned.json")
    with cleaned.open("w", encoding="utf-8") as fh:
        json.dump(kept, fh, ensure_ascii=False)
    return cleaned, ignored


def _short_error(exc: Exception) -> str:
    message = " ".join(str(exc).split())
    return message[:300] + ("…" if len(message) > 300 else "")


def restore_from_zip(uploaded_file, progress=None):
    name = (getattr(uploaded_file, "name", "") or "").lower()
    if not name.endswith(".zip"):
        raise SauvegardeError("Le fichier doit être une archive .zip GED.")

    head = uploaded_file.read(4)
    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)
    if head[:2] != b"PK":
        raise SauvegardeError("Le fichier n'est pas une archive zip valide.")

    fd, tmp_zip = tempfile.mkstemp(prefix="ged-restore-", suffix=".zip")
    os.close(fd)
    try:
        with open(tmp_zip, "wb") as dest:
            if hasattr(uploaded_file, "chunks"):
                for chunk in uploaded_file.chunks():
                    dest.write(chunk)
            else:
                shutil.copyfileobj(uploaded_file, dest)
        restore_from_zip_path(tmp_zip, progress=progress)
    finally:
        try:
            os.unlink(tmp_zip)
        except OSError:
            pass


def restore_from_zip_path(tmp_zip, progress=None):
    extract_dir = Path(tempfile.mkdtemp(prefix="ged-restore-out-"))
    try:
        _notify(progress, "extract", 18, "Lecture de l'archive…")
        with zipfile.ZipFile(tmp_zip, "r") as archive:
            _validate_zip(archive, extract_dir)
            _read_manifest(archive)
            archive.extractall(extract_dir)

        data_file = extract_dir / "data.json"
        if not data_file.is_file():
            raise SauvegardeError("Données manquantes dans l'archive.")

        from django.contrib.contenttypes.models import ContentType
        from django.db import transaction

        # Vidage + import dans une seule transaction : en cas d'échec, la base
        # actuelle est conservée telle quelle.
        try:
            with transaction.atomic():
                _notify(progress, "flush", 40, "Vidage de la base actuelle…")
                call_command("flush", verbosity=0, interactive=False, allow_cascade=True)
                ContentType.objects.clear_cache()
                _notify(progress, "loaddata", 50, "Vérification de la compatibilité…")
                cleaned_file, ignored = _prepare_fixture(data_file)
                if ignored:
                    logger.info(
                        "Restauration : %s objet(s) d'une version différente ignoré(s).",
                        ignored,
                    )
                _notify(progress, "loaddata", 58, "Import des données…")
                with _silence_restore_signals():
                    call_command("loaddata", str(cleaned_file), verbosity=0)
        except Exception as exc:
            ContentType.objects.clear_cache()
            logger.exception("Échec loaddata pendant la restauration")
            raise SauvegardeError(
                f"Restauration impossible : {_short_error(exc)} "
                "Les données actuelles n'ont pas été modifiées."
            ) from exc
        ContentType.objects.clear_cache()

        _notify(progress, "media", 82, "Restauration des fichiers media…")
        _restore_media(extract_dir)
        _notify(progress, "media", 100, "Restauration terminée.")
    finally:
        shutil.rmtree(extract_dir, ignore_errors=True)


def reset_database(keep_user_ids, progress=None):
    User = get_user_model()
    ids = set(keep_user_ids or [])
    ids.update(User.objects.filter(is_superuser=True).values_list("pk", flat=True))
    if not ids:
        raise SauvegardeError("Aucun compte administrateur à conserver.")

    _notify(progress, "flush", 15, "Préparation…")
    safety = _serialize_keep_users(ids)
    _notify(progress, "flush", 35, "Vidage de la base…")
    call_command("flush", verbosity=0, interactive=False, allow_cascade=True)
    _notify(progress, "users", 65, "Conservation des comptes administrateur…")
    _reload_users(safety)
    _notify(progress, "media", 82, "Suppression des fichiers media…")
    _empty_media()
    from gestion_acces.models.entreprise import Entreprise

    Entreprise.reset_to_defaults()
    _notify(progress, "media", 100, "Réinitialisation terminée.")


def run_exclusive(fn, *args, **kwargs):
    if not _lock.acquire(blocking=False):
        raise SauvegardeError("Une opération de sauvegarde est déjà en cours.")
    try:
        return fn(*args, **kwargs)
    finally:
        _lock.release()
