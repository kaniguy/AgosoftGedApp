import os
import tempfile
import unicodedata

from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from gestion_acces.models.journal_activite import JournalActivite
from gestion_acces.services.audit_service import log_activite
from gestion_acces.services.sauvegarde_jobs import (
    create_job,
    job_matches_token,
    make_progress,
    public_job,
    read_job,
    start_job_thread,
    update_job,
)
from gestion_acces.services.sauvegarde_service import (
    CONFIRM_RESET,
    CONFIRM_RESTORE,
    SauvegardeError,
    build_backup_zip,
    reset_database,
    restore_from_zip_path,
)

PERM_VIEW = "gestion_acces.view_sauvegardebase"
PERM_EXPORT = "gestion_acces.exporter_sauvegardebase"
PERM_RESTORE = "gestion_acces.restaurer_sauvegardebase"
PERM_RESET = "gestion_acces.reinitialiser_sauvegardebase"


def _normalize_confirm(value):
    raw = unicodedata.normalize("NFD", (value or "").strip())
    return "".join(ch for ch in raw if unicodedata.category(ch) != "Mn").replace(" ", "").upper()


def _confirm_from_request(request):
    return _normalize_confirm(
        request.query_params.get("confirmation")
        or request.headers.get("X-Sauvegarde-Confirmation")
        or request.data.get("confirmation")
        or request.POST.get("confirmation")
    )


def _has(user, perm=None):
    """Sauvegarde / restauration : réservé aux superutilisateurs."""
    return bool(user and user.is_authenticated and user.is_superuser)


def _forbidden(message="Vous n'avez pas la permission d'effectuer cette action."):
    return Response({"detail": message}, status=status.HTTP_403_FORBIDDEN)


def _job_token(request):
    return (
        request.query_params.get("token")
        or request.headers.get("X-Job-Token")
        or ""
    ).strip()


def _load_job_or_404(job_id, token):
    data = read_job(job_id)
    if not data or not job_matches_token(data, token):
        return None
    return data


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sauvegarde_status_view(request):
    if not (
        _has(request.user, PERM_VIEW)
        or _has(request.user, PERM_EXPORT)
        or _has(request.user, PERM_RESTORE)
        or _has(request.user, PERM_RESET)
    ):
        return _forbidden()

    from django.conf import settings

    return Response(
        {
            "db_name": settings.DATABASES["default"].get("NAME", ""),
            "media": {"fichier_count": None, "taille_octets": None},
            "droits": {
                "exporter": _has(request.user, PERM_EXPORT),
                "restaurer": _has(request.user, PERM_RESTORE),
                "reinitialiser": _has(request.user, PERM_RESET),
            },
            "confirmation": {
                "restaurer": CONFIRM_RESTORE,
                "reinitialiser": CONFIRM_RESET,
            },
        }
    )


def _start_export_job(job_id, user_id, username):
    progress = make_progress(job_id)
    try:
        zip_path, filename = build_backup_zip(progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Export impossible.")
        return
    except Exception:
        update_job(job_id, status="error", error="Export impossible pour le moment.", message="Échec.")
        return

    from django.contrib.auth import get_user_model

    user = get_user_model().objects.filter(pk=user_id).first()
    log_activite(
        action=JournalActivite.Action.EXPORTER,
        description="Export de la base de données et des fichiers media",
        user=user,
        username=username,
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sauvegarde_export_view(request):
    if not _has(request.user, PERM_EXPORT):
        return _forbidden("Vous n'avez pas la permission d'exporter la base.")

    job = create_job("export", request.user.pk, request.user.get_username())
    started = start_job_thread(
        job["id"],
        _start_export_job,
        job["id"],
        request.user.pk,
        request.user.get_username(),
    )
    if not started:
        return Response(
            {"detail": "Une opération de sauvegarde est déjà en cours."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"job_id": job["id"], "token": job["token"], **public_job(job)})


def _start_restore_job(job_id, zip_path, username):
    progress = make_progress(job_id)
    try:
        restore_from_zip_path(zip_path, progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Restauration impossible.")
        return
    except Exception:
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

    from django.contrib.auth import get_user_model

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def sauvegarde_restore_view(request):
    if not _has(request.user, PERM_RESTORE):
        return _forbidden("Vous n'avez pas la permission de restaurer la base.")

    confirmation = _confirm_from_request(request)
    if confirmation != CONFIRM_RESTORE:
        return Response(
            {"detail": f"Saisissez {CONFIRM_RESTORE} pour confirmer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    uploaded = request.FILES.get("fichier")
    if not uploaded:
        return Response(
            {"detail": "Choisissez un fichier de sauvegarde."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    name = (getattr(uploaded, "name", "") or "").lower()
    if not name.endswith(".zip"):
        return Response(
            {"detail": "Le fichier doit être une archive .zip GED."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    fd, tmp_zip = tempfile.mkstemp(prefix="ged-restore-", suffix=".zip")
    os.close(fd)
    try:
        with open(tmp_zip, "wb") as dest:
            for chunk in uploaded.chunks():
                dest.write(chunk)
        with open(tmp_zip, "rb") as check:
            if check.read(2) != b"PK":
                os.unlink(tmp_zip)
                return Response(
                    {"detail": "Le fichier n'est pas une archive zip valide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
    except Exception:
        try:
            os.unlink(tmp_zip)
        except OSError:
            pass
        return Response(
            {"detail": "Impossible de lire le fichier envoyé."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = request.user.get_username()
    job = create_job("restore", request.user.pk, username)
    update_job(job["id"], stage="upload", percent=12, message="Archive reçue.")
    started = start_job_thread(job["id"], _start_restore_job, job["id"], tmp_zip, username)
    if not started:
        try:
            os.unlink(tmp_zip)
        except OSError:
            pass
        return Response(
            {"detail": "Une opération de sauvegarde est déjà en cours."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"job_id": job["id"], "token": job["token"], **public_job(read_job(job["id"]))})


def _start_reset_job(job_id, keep_user_id, username):
    progress = make_progress(job_id)
    try:
        reset_database([keep_user_id], progress=progress)
    except SauvegardeError as exc:
        update_job(job_id, status="error", error=str(exc), message="Réinitialisation impossible.")
        return
    except Exception:
        update_job(
            job_id,
            status="error",
            error="Réinitialisation impossible pour le moment.",
            message="Échec.",
        )
        return

    from django.contrib.auth import get_user_model

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sauvegarde_reset_view(request):
    if not _has(request.user, PERM_RESET):
        return _forbidden("Vous n'avez pas la permission de réinitialiser la base.")

    confirmation = _confirm_from_request(request)
    if confirmation != CONFIRM_RESET:
        return Response(
            {"detail": f"Saisissez {CONFIRM_RESET} pour confirmer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = request.user.get_username()
    job = create_job("reset", request.user.pk, username)
    started = start_job_thread(
        job["id"],
        _start_reset_job,
        job["id"],
        request.user.pk,
        username,
    )
    if not started:
        return Response(
            {"detail": "Une opération de sauvegarde est déjà en cours."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"job_id": job["id"], "token": job["token"], **public_job(job)})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def sauvegarde_job_view(request, job_id):
    data = _load_job_or_404(job_id, _job_token(request))
    if not data:
        return Response({"detail": "Tâche introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(public_job(data))


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def sauvegarde_job_download_view(request, job_id):
    data = _load_job_or_404(job_id, _job_token(request))
    if not data:
        return Response({"detail": "Tâche introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if data.get("kind") != "export" or data.get("status") != "done":
        return Response({"detail": "Archive pas encore prête."}, status=status.HTTP_409_CONFLICT)
    zip_path = data.get("download_path") or ""
    filename = data.get("download_name") or "ged-sauvegarde.zip"
    if not zip_path or not os.path.isfile(zip_path):
        return Response({"detail": "Fichier d'export introuvable."}, status=status.HTTP_404_NOT_FOUND)

    handle = open(zip_path, "rb")

    def _close():
        handle.close()
        try:
            os.unlink(zip_path)
        except OSError:
            pass

    response = FileResponse(handle, as_attachment=True, filename=filename)
    response["Content-Type"] = "application/zip"
    original_close = response.close

    def close_and_cleanup():
        original_close()
        _close()

    response.close = close_and_cleanup
    return response
