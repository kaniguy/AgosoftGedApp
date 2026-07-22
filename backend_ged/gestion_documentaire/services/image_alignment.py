"""
Alignement automatique document importé / modèle de capture.
Corrige les décalages de scan (translation + échelle) avant l'extraction par zones.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

ALIGNMENT_MIN_SCORE = 0.45
ALIGNMENT_MAX_SIDE = 1200


def _ensure_cv2_np():
    """Charge OpenCV et NumPy à la demande."""
    try:
        import cv2
        import numpy as np
        return cv2, np
    except ImportError as exc:
        raise ImportError("OpenCV et NumPy sont requis pour l'alignement.") from exc


def _pil_to_gray_array(image):
    """Convertit une image PIL en tableau niveaux de gris."""
    cv2, np = _ensure_cv2_np()
    rgb = np.array(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def _resize_max_side(gray, max_side: int):
    """Redimensionne une image grise en conservant le ratio (côté max = max_side)."""
    cv2, np = _ensure_cv2_np()
    height, width = gray.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return gray, 1.0
    scale = max_side / longest
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    resized = cv2.resize(gray, new_size, interpolation=cv2.INTER_AREA)
    return resized, scale


def compute_page_alignment(model_image, import_image) -> dict | None:
    """
    Estime la translation et l'échelle entre la page modèle et la page importée.
    Retourne {offset_x, offset_y, scale_x, scale_y, score} en coordonnées normalisées
    ou None si l'alignement est peu fiable.
    """
    if model_image is None or import_image is None:
        return None

    try:
        cv2, np = _ensure_cv2_np()
        model_gray = _resize_max_side(_pil_to_gray_array(model_image), ALIGNMENT_MAX_SIDE)[0]
        import_gray = _resize_max_side(_pil_to_gray_array(import_image), ALIGNMENT_MAX_SIDE)[0]

        model_h, model_w = model_gray.shape[:2]
        import_h, import_w = import_gray.shape[:2]

        if model_w < 8 or model_h < 8 or import_w < model_w or import_h < model_h:
            return _fallback_scale_alignment(model_image, import_image)

        model_edges = cv2.Canny(model_gray, 50, 150)
        import_edges = cv2.Canny(import_gray, 50, 150)

        result = cv2.matchTemplate(import_edges, model_edges, cv2.TM_CCOEFF_NORMED)
        _, max_score, _, max_loc = cv2.minMaxLoc(result)

        if max_score < ALIGNMENT_MIN_SCORE:
            logger.info("Alignement ignoré — score template faible (%.2f)", max_score)
            return _fallback_scale_alignment(model_image, import_image)

        dx_px, dy_px = max_loc
        mw, mh = model_image.size
        iw, ih = import_image.size

        scale_x = (model_w / mw) * (iw / import_w) if import_w else 1.0
        scale_y = (model_h / mh) * (ih / import_h) if import_h else 1.0

        offset_x = (dx_px / import_w) if import_w else 0.0
        offset_y = (dy_px / import_h) if import_h else 0.0

        return {
            "offset_x": offset_x,
            "offset_y": offset_y,
            "scale_x": iw / mw if mw else 1.0,
            "scale_y": ih / mh if mh else 1.0,
            "score": round(float(max_score), 3),
        }
    except Exception:
        logger.exception("Échec du calcul d'alignement")
        return _fallback_scale_alignment(model_image, import_image)


def _fallback_scale_alignment(model_image, import_image) -> dict:
    """
    Alignement minimal : mise à l'échelle si les dimensions de page diffèrent.
    """
    mw, mh = model_image.size
    iw, ih = import_image.size
    if mw <= 0 or mh <= 0:
        return {"offset_x": 0.0, "offset_y": 0.0, "scale_x": 1.0, "scale_y": 1.0, "score": 0.0}

    return {
        "offset_x": 0.0,
        "offset_y": 0.0,
        "scale_x": iw / mw,
        "scale_y": ih / mh,
        "score": 0.0,
    }


def apply_alignment_to_rect(rect: dict, alignment: dict | None) -> dict:
    """
    Applique la transformation d'alignement à un rectangle normalisé (défini sur le modèle).
    """
    if not alignment:
        return rect

    scale_x = alignment.get("scale_x", 1.0)
    scale_y = alignment.get("scale_y", 1.0)
    offset_x = alignment.get("offset_x", 0.0)
    offset_y = alignment.get("offset_y", 0.0)

    x = rect["x"] * scale_x + offset_x
    y = rect["y"] * scale_y + offset_y
    width = rect["width"] * scale_x
    height = rect["height"] * scale_y

    return {
        "x": max(0.0, min(1.0, x)),
        "y": max(0.0, min(1.0, y)),
        "width": max(0.01, min(1.0 - x, width)),
        "height": max(0.01, min(1.0 - y, height)),
    }
