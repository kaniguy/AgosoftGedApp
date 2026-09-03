"""Export, restauration et réinitialisation (données Django + dossier media)."""

from __future__ import annotations

import json
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


@contextmanager
def _silence_user_profile_signals():
    from django.contrib.auth.models import User
    from django.db.models.signals import post_save

    from gestion_acces.models.user_profile import create_user_profile, save_user_profile

    post_save.disconnect(create_user_profile, sender=User)
    post_save.disconnect(save_user_profile, sender=User)
    try:
        yield
    finally:
        post_save.connect(create_user_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)


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
    with _silence_user_profile_signals():
        for obj in serializers.deserialize("json", payload):
            obj.save()


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

        User = get_user_model()
        safety = _serialize_keep_users(
            list(User.objects.filter(is_superuser=True).values_list("pk", flat=True))
        )

        try:
            _notify(progress, "flush", 40, "Vidage de la base actuelle…")
            call_command("flush", verbosity=0, interactive=False, allow_cascade=True)
            _notify(progress, "loaddata", 58, "Import des données…")
            with _silence_user_profile_signals():
                call_command("loaddata", str(data_file), verbosity=0)
        except SauvegardeError:
            raise
        except Exception as exc:
            _reload_users(safety)
            raise SauvegardeError(
                "Restauration impossible. Les comptes administrateur ont été conservés."
            ) from exc

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
