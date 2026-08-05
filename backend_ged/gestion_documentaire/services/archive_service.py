"""Création d'archives RAR (WinRAR) ou ZIP pour téléchargement groupé."""
import logging
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import date

from gestion_documentaire.services.annotation_pdf_service import prepare_pdf_for_download
from gestion_documentaire.services.document_storage import download_display_filename

logger = logging.getLogger(__name__)


def _find_rar_executable():
    candidates = [
        shutil.which("rar"),
        shutil.which("Rar"),
        r"C:\Program Files\WinRAR\Rar.exe",
        r"C:\Program Files (x86)\WinRAR\Rar.exe",
        r"C:\Program Files\WinRAR\WinRAR.exe",
        r"C:\Program Files (x86)\WinRAR\WinRAR.exe",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", (name or "document").strip())
    return cleaned or "document"


def _archive_entry_name(doc, used: dict) -> str:
    raw = os.path.basename(doc.fichier.name) if doc.fichier else "document"
    if not raw or raw == "document":
        type_label = getattr(doc.type_document, "libelle", None) or "document"
        ext = os.path.splitext(raw)[1] or ".pdf"
        raw = f"{type_label}{ext}"
    # Nom lisible pour l'utilisateur (sans suffixe technique de stockage)
    raw = download_display_filename(raw, fallback="document")
    base = _safe_filename(raw)
    stem, ext = os.path.splitext(base)
    if base in used:
        used[base] += 1
        base = f"{stem}_{used[base]}{ext}"
    else:
        used[base] = 0
    return base


def _try_build_rar(files_dir: str, archive_path: str, file_names: list[str]) -> bool:
    """Tente de créer une archive RAR. Retourne True en cas de succès."""
    rar_exe = _find_rar_executable()
    if not rar_exe:
        logger.warning("WinRAR introuvable : fallback ZIP pour l'archive multi-documents.")
        return False

    # Liste explicite des fichiers (plus fiable que « . » selon les versions WinRAR)
    cmd = [rar_exe, "a", "-ep1", "-idq", "-y", archive_path, *file_names]
    try:
        result = subprocess.run(
            cmd,
            cwd=files_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("Échec exécution WinRAR (%s) : %s", rar_exe, exc)
        return False

    if result.returncode == 0 and os.path.isfile(archive_path) and os.path.getsize(archive_path) > 0:
        return True

    # Seconde tentative avec le joker (certaines versions WinRAR)
    if os.path.isfile(archive_path):
        try:
            os.remove(archive_path)
        except OSError:
            pass
    cmd_fallback = [rar_exe, "a", "-ep1", "-idq", "-y", archive_path, "*.*"]
    try:
        result = subprocess.run(
            cmd_fallback,
            cwd=files_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("Échec WinRAR (fallback *.*) : %s", exc)
        return False

    if result.returncode == 0 and os.path.isfile(archive_path) and os.path.getsize(archive_path) > 0:
        return True

    stderr = (result.stderr or result.stdout or "").strip()
    logger.warning(
        "Création RAR échouée (code=%s) via %s : %s",
        result.returncode,
        rar_exe,
        stderr[:500] or "sans détail",
    )
    return False


def build_documents_archive(documents):
    """
    Compresse les fichiers des documents dans une archive RAR (prioritaire) ou ZIP.

    Returns:
        tuple (bytes, extension) — extension « .rar » ou « .zip »
    """
    if not documents:
        raise ValueError("Aucun document à archiver.")

    with tempfile.TemporaryDirectory() as tmpdir:
        files_dir = os.path.join(tmpdir, "files")
        os.makedirs(files_dir, exist_ok=True)
        used_names: dict = {}
        copied = 0
        file_names: list[str] = []

        for doc in documents:
            if not doc.fichier:
                continue
            try:
                with doc.fichier.open("rb") as handle:
                    content = handle.read()
            except Exception:
                logger.exception("Lecture fichier impossible pour document %s", getattr(doc, "pk", "?"))
                continue
            if not content:
                continue
            arc_name = _archive_entry_name(doc, used_names)
            dest = os.path.join(files_dir, arc_name)
            annotations = list(getattr(doc, "annotations", None) or [])
            if content[:4] == b"%PDF":
                content = prepare_pdf_for_download(content, annotations)
            with open(dest, "wb") as handle:
                handle.write(content)
            file_names.append(arc_name)
            copied += 1

        if copied == 0:
            raise ValueError("Aucun fichier disponible pour l'archive.")

        stamp = date.today().isoformat()
        archive_path = os.path.join(tmpdir, f"documents-{stamp}.rar")
        if _try_build_rar(files_dir, archive_path, file_names):
            with open(archive_path, "rb") as handle:
                return handle.read(), ".rar"

        zip_path = os.path.join(tmpdir, f"documents-{stamp}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for name in file_names:
                zf.write(os.path.join(files_dir, name), arcname=name)
        with open(zip_path, "rb") as handle:
            return handle.read(), ".zip"
