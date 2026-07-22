"""Décodage des codes QR sur les documents (indépendant de l'OCR texte)."""

from __future__ import annotations

import io
import logging
from typing import BinaryIO

logger = logging.getLogger(__name__)

# Zoom : 1 seul zoom par défaut (rapide), escalade seulement si échec
QR_PDF_ZOOMS = (2.8, 4.0)
QR_MAX_PAGES = 2
QR_ZONE_MARGIN = 0.04
QR_MIN_SIDE_PX = 240


def _is_qr_champ(champ) -> bool:
    return getattr(champ, "type_champ", None) == "qr"


def _champ_has_zone(champ) -> bool:
    return (
        champ.zone_x is not None
        and champ.zone_y is not None
        and champ.zone_width is not None
        and champ.zone_height is not None
        and champ.zone_width > 0
        and champ.zone_height > 0
    )


def _normalized_rect(champ) -> dict:
    return {
        "x": float(champ.zone_x),
        "y": float(champ.zone_y),
        "width": float(champ.zone_width),
        "height": float(champ.zone_height),
    }


def _pil_to_bgr(image):
    import cv2
    import numpy as np

    rgb = image.convert("RGB")
    arr = np.asarray(rgb)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _append_unique(found: list[str], text: str | None) -> None:
    payload = (text or "").strip()
    if payload and payload not in found:
        found.append(payload)


def _try_opencv_detectors(bgr, found: list[str], heavy: bool = False) -> None:
    import cv2

    # 1) QRCodeDetector classique (rapide)
    try:
        detector = cv2.QRCodeDetector()
        ok, decoded_info, _points, _ = detector.detectAndDecodeMulti(bgr)
        if ok and decoded_info:
            for item in decoded_info:
                _append_unique(found, item)
        if not found:
            data, _points, _ = detector.detectAndDecode(bgr)
            _append_unique(found, data)
    except Exception:
        logger.debug("QRCodeDetector échec", exc_info=True)

    if found:
        return

    # 2) Aruco — uniquement en mode « heavy » (zone / 2ᵉ tentative)
    if not heavy:
        return

    try:
        aruco = cv2.QRCodeDetectorAruco()
        ok, decoded_info, _points, _ = aruco.detectAndDecodeMulti(bgr)
        if ok and decoded_info:
            for item in decoded_info:
                _append_unique(found, item)
        if not found:
            data, _points, _ = aruco.detectAndDecode(bgr)
            _append_unique(found, data)
    except Exception:
        logger.debug("QRCodeDetectorAruco échec", exc_info=True)

    if found:
        return

    try:
        wechat = cv2.wechat_qrcode_WeChatQRCode()
        texts, _points = wechat.detectAndDecode(bgr)
        for item in texts or []:
            _append_unique(found, item)
    except Exception:
        logger.debug("WeChatQRCode indisponible ou échec", exc_info=True)


def _image_variants(bgr, heavy: bool = False):
    """Variantes d'image. Mode léger = couleur + gris uniquement."""
    import cv2

    variants = [bgr]
    try:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        variants.append(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))

        h, w = gray.shape[:2]
        if max(h, w) < QR_MIN_SIDE_PX:
            scale = QR_MIN_SIDE_PX / max(h, w)
            up = cv2.resize(
                bgr,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_CUBIC,
            )
            variants.append(up)

        if not heavy:
            return variants

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        variants.append(cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR))

        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
        )
        variants.append(cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR))
    except Exception:
        logger.debug("Variantes QR en échec", exc_info=True)

    return variants


def decode_qr_codes_from_pil(image, heavy: bool = False) -> list[str]:
    """
    Décode un ou plusieurs QR présents dans une image PIL.
    heavy=False : chemin rapide (page entière). heavy=True : plus d'essais (zone).
    """
    if image is None:
        return []

    try:
        import cv2  # noqa: F401
    except ImportError:
        logger.warning("OpenCV indisponible — décodage QR impossible.")
        return []

    bgr = _pil_to_bgr(image)
    found: list[str] = []

    for variant in _image_variants(bgr, heavy=heavy):
        _try_opencv_detectors(variant, found, heavy=heavy)
        if found:
            break

    # Repli lourd si le parcours léger a échoué
    if not found and not heavy:
        for variant in _image_variants(bgr, heavy=True):
            _try_opencv_detectors(variant, found, heavy=True)
            if found:
                break

    return found


def _render_pdf_page(file_bytes: bytes, page_index: int, zoom: float):
    from gestion_documentaire.services.ocr_service import _ensure_image_deps

    fitz, _np, Image = _ensure_image_deps()
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if page_index < 0 or page_index >= len(doc):
            return None
        page = doc[page_index]
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    finally:
        doc.close()


def _render_pdf_zone(file_bytes: bytes, page_index: int, rect: dict, zoom: float, margin: float):
    from gestion_documentaire.services.ocr_service import _ensure_image_deps, _expand_rect

    fitz, _np, Image = _ensure_image_deps()
    crop_rect = _expand_rect(rect, margin) if margin > 0 else rect
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if page_index < 0 or page_index >= len(doc):
            return None
        page = doc[page_index]
        page_rect = page.rect
        clip = fitz.Rect(
            page_rect.x0 + crop_rect["x"] * page_rect.width,
            page_rect.y0 + crop_rect["y"] * page_rect.height,
            page_rect.x0 + (crop_rect["x"] + crop_rect["width"]) * page_rect.width,
            page_rect.y0 + (crop_rect["y"] + crop_rect["height"]) * page_rect.height,
        )
        if clip.is_empty or clip.width <= 0 or clip.height <= 0:
            return None
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
        if pixmap.width <= 0 or pixmap.height <= 0:
            return None
        return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    finally:
        doc.close()


def _render_page_for_qr(file_bytes: bytes, filename: str, page_index: int, zoom: float | None = None):
    """Rend une page à zoom élevé (meilleure lecture QR densés)."""
    from gestion_documentaire.services.ocr_service import (
        PDF_EXTENSIONS,
        _ensure_image_deps,
        _extension_from_name,
    )

    zoom = zoom if zoom is not None else QR_PDF_ZOOMS[0]
    fitz, _np, Image = _ensure_image_deps()
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        return _render_pdf_page(file_bytes, page_index, zoom)

    if page_index > 0:
        return None

    with Image.open(io.BytesIO(file_bytes)) as image:
        return image.convert("RGB")


def _render_zone_for_qr(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
    zoom: float | None = None,
):
    from gestion_documentaire.services.ocr_service import (
        PDF_EXTENSIONS,
        _ensure_image_deps,
        _extension_from_name,
        render_zone_clip_as_pil,
    )

    zoom = zoom if zoom is not None else QR_PDF_ZOOMS[-1]
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        return _render_pdf_zone(file_bytes, page_index, rect, zoom, QR_ZONE_MARGIN)

    # Image : repli sur le crop OCR existant
    return render_zone_clip_as_pil(
        file_bytes,
        filename,
        page_index,
        rect,
        margin=QR_ZONE_MARGIN,
    )


def _decode_with_zoom_retries(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict | None = None,
) -> list[str]:
    """Essaie plusieurs zooms jusqu'à obtenir un QR."""
    from gestion_documentaire.services.ocr_service import PDF_EXTENSIONS, _extension_from_name

    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    zooms = QR_PDF_ZOOMS if is_pdf else (1.0,)
    heavy = rect is not None

    for zoom in zooms:
        try:
            if rect is not None:
                image = _render_zone_for_qr(file_bytes, filename, page_index, rect, zoom=zoom)
            else:
                image = _render_page_for_qr(file_bytes, filename, page_index, zoom=zoom)
            codes = decode_qr_codes_from_pil(image, heavy=heavy)
            if codes:
                return codes
        except Exception:
            logger.debug("Zoom QR %.1f échoué", zoom, exc_info=True)
    return []


def extract_qr_field_values(
    champs,
    file_obj: BinaryIO,
    filename: str = "",
    ocr_pages: set[int] | None = None,
) -> list[dict]:
    """
    Extrait le contenu des champs de type « qr ».
    - Avec zone : décode uniquement le rectangle (plusieurs zooms).
    - Sans zone : scanne d'abord la page 1, puis page 2 si besoin.
    """
    from gestion_documentaire.services.ocr_service import (
        _read_file_bytes,
        get_page_count_from_bytes,
    )

    qr_champs = [c for c in champs if _is_qr_champ(c)]
    if not qr_champs:
        return []

    file_bytes = _read_file_bytes(file_obj)
    extracted: list[dict] = []
    used_payloads: set[str] = set()

    zone_champs = [c for c in qr_champs if _champ_has_zone(c)]
    free_champs = [c for c in qr_champs if not _champ_has_zone(c)]

    for champ in zone_champs:
        page_index = int(champ.capture_page or 0)
        if ocr_pages is not None and page_index not in ocr_pages:
            continue
        rect = _normalized_rect(champ)
        try:
            codes = _decode_with_zoom_retries(file_bytes, filename, page_index, rect=rect)
            if not codes:
                codes = _decode_with_zoom_retries(file_bytes, filename, page_index, rect=None)
            if codes:
                payload = codes[0]
                extracted.append({
                    "champ_id": champ.id,
                    "valeur": payload[:4000],
                    "confidence": 1.0,
                    "methode": "qr_zone",
                })
                used_payloads.add(payload)
        except Exception:
            logger.exception("Erreur décodage QR zone champ %s", champ.id)

    if not free_champs:
        return extracted

    page_count = get_page_count_from_bytes(file_bytes, filename)
    pages_to_scan: list[int] = []
    for page_index in range(min(page_count, QR_MAX_PAGES)):
        if ocr_pages is not None and page_index not in ocr_pages:
            continue
        pages_to_scan.append(page_index)

    page_codes: list[str] = []
    for page_index in pages_to_scan:
        if len(page_codes) >= len(free_champs):
            break
        try:
            for code in _decode_with_zoom_retries(file_bytes, filename, page_index, rect=None):
                if code not in used_payloads and code not in page_codes:
                    page_codes.append(code)
                    if len(page_codes) >= len(free_champs):
                        break
        except Exception:
            logger.exception("Erreur décodage QR page %s", page_index)

    for champ, payload in zip(free_champs, page_codes):
        extracted.append({
            "champ_id": champ.id,
            "valeur": payload[:4000],
            "confidence": 0.95,
            "methode": "qr_page",
        })
        used_payloads.add(payload)

    return extracted
