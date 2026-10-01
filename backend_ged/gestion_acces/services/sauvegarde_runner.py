"""Exécution des tâches de sauvegarde (export, restauration, réinitialisation).

Appelé par la commande `executer_tache_sauvegarde`, dans un processus distinct de
Gunicorn : le recyclage des workers (--max-requests) n'interrompt plus la tâche.
"""

from __future__ import annotations

import logging
import os

from django.contrib.auth import get_user_model

from gestion_acces.models.journal_activite import JournalActivite
from gestion_acces.services.audit_service import log_activite
from gestion_acces.services.sauvegarde_jobs import make_progress, read_job, update_job
from gestion_acces.services.sauvegarde_service import (
    SauvegardeError,
    build_backup_zip,
    reset_database,
    restore_from_zip_path,
)

logger = logging.getLogger(__name__)


def _run_export(job_id, job):
    progress = make_progress(job_id)
    try:
        zip_path, filename = build_backup_zip(progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Export impossible.")
        return
    except Exception:
        logger.exception("Échec de l'export de la base")
        update_job(job_id, status="error", error="Export impossible pour le moment.", message="Échec.")
        return

    user = get_user_model().objects.filter(pk=job.get("user_id")).first()
    log_activite(
        action=JournalActivite.Action.EXPORTER,
        description="Export de la base de données et des fichiers media",
        user=user,
        username=job.get("username") or "",
        categorie=JournalActivite.Categorie.BASE_DONNEES,
        objet_type="sauvegarde",
    )
    update_job(
        job_id,
        status="done",
        stage="ready",
        percent=100,
        message="Archive prête. Téléchargement…",
        download_path=zip_path,
        download_name=filename,
    )


def _run_restore(job_id, job):
    zip_path = job.get("zip_path") or ""
    username = job.get("username") or ""
    progress = make_progress(job_id)
    try:
        restore_from_zip_path(zip_path, progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Restauration impossible.")
        return
    except Exception:
        logger.exception("Échec de la restauration de la base")
        update_job(
            job_id,
            status="error",
            error="Restauration impossible pour le moment.",
            message="Échec.",
        )
        return
    finally:
        try:
            os.unlink(zip_path)
        except OSError:
            pass

    restored_user = get_user_model().objects.filter(username=username).first()
    log_activite(
        action=JournalActivite.Action.RESTAURER,
        description="Restauration de la base de données et des fichiers media",
        user=restored_user,
        username=username,
        categorie=JournalActivite.Categorie.BASE_DONNEES,
        objet_type="sauvegarde",
    )
    update_job(
        job_id,
        status="done",
        stage="media",
        percent=100,
        message="Restauration terminée. Reconnectez-vous.",
    )


def _run_reset(job_id, job):
    username = job.get("username") or ""
    progress = make_progress(job_id)
    try:
        reset_database([job.get("user_id")], progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Réinitialisation impossible.")
        return
    except Exception:
        logger.exception("Échec de la réinitialisation de la base")
        update_job(
            job_id,
            status="error",
            error="Réinitialisation impossible pour le moment.",
            message="Échec.",
        )
        return

    kept_user = get_user_model().objects.filter(username=username).first()
    log_activite(
        action=JournalActivite.Action.REINITIALISER,
        description="Réinitialisation de la base de données",
        user=kept_user,
        username=username,
        categorie=JournalActivite.Categorie.BASE_DONNEES,
        objet_type="sauvegarde",
    )
    update_job(
        job_id,
        status="done",
        stage="media",
        percent=100,
        message="Base réinitialisée. Les comptes administrateur ont été conservés.",
    )


RUNNERS = {
    "export": _run_export,
    "restore": _run_restore,
    "reset": _run_reset,
}


def run_job(job_id: str):
    job = read_job(job_id)
    if not job:
        logger.error("Tâche de sauvegarde %s introuvable.", job_id)
        return
    runner = RUNNERS.get(job.get("kind"))
    if not runner:
        update_job(job_id, status="error", error="Type de tâche inconnu.", message="Échec.")
        return
    runner(job_id, job)
