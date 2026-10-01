"""Jobs de sauvegarde avec progression (fichiers JSON, partagés entre workers Gunicorn)."""

from __future__ import annotations

import json
import logging
import os
import secrets
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from django.conf import settings

JOBS_DIR = Path(os.environ.get("GED_BACKUP_JOBS_DIR", "/tmp/ged-sauvegarde-jobs"))
LOCK_PATH = JOBS_DIR / "exclusive.lock"
HEARTBEAT_SECONDS = 15
# Sans signe de vie au-delà de ce délai, la tâche est considérée comme interrompue.
STALE_AFTER_SECONDS = 120

logger = logging.getLogger(__name__)
_update_lock = threading.Lock()

STEPS = {
    "export": [
        {"id": "dump", "label": "Export des données SQL"},
        {"id": "archive", "label": "Compression des fichiers media"},
        {"id": "ready", "label": "Téléchargement de l'archive"},
    ],
    "restore": [
        {"id": "upload", "label": "Réception de l'archive"},
        {"id": "extract", "label": "Lecture de l'archive"},
        {"id": "flush", "label": "Vidage de la base actuelle"},
        {"id": "loaddata", "label": "Import des données"},
        {"id": "media", "label": "Restauration des fichiers"},
    ],
    "reset": [
        {"id": "flush", "label": "Vidage de la base"},
        {"id": "users", "label": "Conservation des administrateurs"},
        {"id": "media", "label": "Suppression des fichiers media"},
    ],
}


def _job_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def _write_atomic(path: Path, data: dict):
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def create_job(kind: str, user_id=None, username: str = "") -> dict:
    job_id = uuid.uuid4().hex
    data = {
        "id": job_id,
        "token": secrets.token_urlsafe(32),
        "kind": kind,
        "user_id": user_id,
        "username": username or "",
        "status": "running",
        "stage": STEPS[kind][0]["id"],
        "percent": 1,
        "message": "Démarrage…",
        "error": "",
        "download_path": "",
        "download_name": "",
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    _write_atomic(_job_path(job_id), data)
    return data


def read_job(job_id: str) -> dict | None:
    path = _job_path(job_id)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def update_job(job_id: str, **fields) -> dict | None:
    with _update_lock:
        data = read_job(job_id)
        if not data:
            return None
        data.update(fields)
        data["updated_at"] = time.time()
        _write_atomic(_job_path(job_id), data)
        return data


def _interruption_message(data: dict) -> str:
    if data.get("kind") == "restore" and data.get("stage") != "media":
        return (
            "La restauration a été interrompue avant la fin (redémarrage du serveur ?). "
            "La base n'a pas été modifiée : relancez la restauration."
        )
    if data.get("kind") == "restore":
        return (
            "La restauration a été interrompue pendant la copie des fichiers media. "
            "Les données sont restaurées mais des fichiers peuvent manquer : relancez la restauration."
        )
    return "L'opération a été interrompue avant la fin (redémarrage du serveur ?). Relancez-la."


def refresh_if_stale(data: dict | None) -> dict | None:
    """Marque en erreur une tâche « en cours » qui ne donne plus signe de vie."""
    if not data or data.get("status") != "running":
        return data
    if time.time() - float(data.get("updated_at") or 0) < STALE_AFTER_SECONDS:
        return data
    return update_job(
        data["id"],
        status="error",
        error=_interruption_message(data),
        message="Opération interrompue.",
    ) or data


def public_job(data: dict) -> dict:
    kind = data.get("kind") or "export"
    stage = data.get("stage") or ""
    seen = False
    steps = []
    for step in STEPS.get(kind, []):
        done = data.get("status") == "done" or (not seen and step["id"] != stage)
        if step["id"] == stage:
            seen = True
            done = data.get("status") == "done"
        steps.append({"id": step["id"], "label": step["label"], "done": done})
    return {
        "id": data.get("id"),
        "kind": kind,
        "status": data.get("status"),
        "stage": stage,
        "percent": int(data.get("percent") or 0),
        "message": data.get("message") or "",
        "error": data.get("error") or "",
        "download_ready": data.get("status") == "done" and bool(data.get("download_path")),
        "filename": data.get("download_name") or "",
        "steps": steps,
    }


def job_matches_token(data: dict, token: str) -> bool:
    return bool(data and token and secrets.compare_digest(str(data.get("token") or ""), str(token)))


class ExclusiveLock:
    def __init__(self):
        self._fh = None

    def acquire(self) -> bool:
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        self._fh = open(LOCK_PATH, "a+", encoding="utf-8")
        try:
            import fcntl

            fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            self._fh.close()
            self._fh = None
            return False

    def release(self):
        if not self._fh:
            return
        try:
            import fcntl

            fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        try:
            self._fh.close()
        except OSError:
            pass
        self._fh = None


def _mark_already_running(job_id: str):
    update_job(
        job_id,
        status="error",
        error="Une opération de sauvegarde est déjà en cours.",
        message="Opération déjà en cours.",
    )


def start_job_process(job_id: str, **params) -> bool:
    """
    Lance la tâche dans un processus indépendant (commande executer_tache_sauvegarde).
    Les paramètres sont stockés dans le fichier de la tâche.
    """
    probe = ExclusiveLock()
    if not probe.acquire():
        _mark_already_running(job_id)
        return False
    probe.release()

    if params:
        update_job(job_id, **params)
    try:
        process = subprocess.Popen(
            [sys.executable, "manage.py", "executer_tache_sauvegarde", job_id],
            cwd=str(settings.BASE_DIR),
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception:
        logger.exception("Impossible de lancer la tâche de sauvegarde %s", job_id)
        update_job(
            job_id,
            status="error",
            error="Impossible de démarrer l'opération.",
            message="Échec.",
        )
        return False

    # Récupère le code de sortie pour ne pas laisser de processus zombie.
    threading.Thread(target=process.wait, daemon=True).start()
    return True


def run_in_current_process(job_id: str, fn):
    """Exécute la tâche avec verrou exclusif et signal de vie périodique."""
    lock = ExclusiveLock()
    if not lock.acquire():
        _mark_already_running(job_id)
        return

    stop = threading.Event()

    def heartbeat():
        while not stop.wait(HEARTBEAT_SECONDS):
            data = read_job(job_id)
            if not data or data.get("status") != "running":
                return
            update_job(job_id)

    threading.Thread(target=heartbeat, daemon=True).start()
    try:
        fn(job_id)
    except Exception as exc:
        logger.exception("Échec de la tâche de sauvegarde %s", job_id)
        update_job(
            job_id,
            status="error",
            error=str(exc) or "Opération impossible.",
            message="Échec.",
        )
    finally:
        stop.set()
        lock.release()


def make_progress(job_id: str):
    def progress(stage: str, percent: int, message: str):
        update_job(
            job_id,
            stage=stage,
            percent=max(0, min(100, int(percent))),
            message=message,
            status="running",
        )

    return progress
