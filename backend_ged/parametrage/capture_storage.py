"""Chemins de stockage des documents modèles de capture (paramétrage)."""

import os
import uuid

from django.utils.text import slugify

CAPTURE_MODELE_ROOT = "capture_modeles"


def _join_path(*parts):
    """Joint les segments de chemin avec des barres obliques."""
    return "/".join(str(p).strip("/") for p in parts if p)


def capture_modele_upload_path(instance, filename):
    """
    Détermine le chemin de stockage du fichier modèle pour un type de document.
    Exemple : capture_modeles/facture-achat/abc12345.pdf
    """
    code_slug = slugify(instance.code or f"type-{instance.pk}")[:50] or f"type-{instance.pk}"
    base, ext = os.path.splitext(filename or "modele")
    ext = ext.lower() if ext else ".pdf"
    unique = uuid.uuid4().hex[:8]
    safe_base = slugify(base)[:40] or "modele"
    return _join_path(CAPTURE_MODELE_ROOT, code_slug, f"{safe_base}_{unique}{ext}")
