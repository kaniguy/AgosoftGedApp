"""Décodage des codes-barres sur les documents (indépendant de l'OCR texte)."""

from __future__ import annotations

import io
import logging
import re
from typing import BinaryIO

logger = logging.getLogger(__name__)

BARCODE_PDF_ZOOMS = (3.0, 5.0, 7.0, 9.0)
BARCODE_MAX_PAGES = 6
BARCODE_ZONE_MARGIN = 0.06
BARCODE_MIN_SIDE_PX = 320
BARCODE_HRI_ZONE_RATIO = 0.38


def _is_barcode_champ(champ) -> bool:
    return getattr(champ, "type_champ", None) == "code_barre"


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


def _normalize_digits(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _ean8_valid(digits: str) -> bool:
    if len(digits) != 8 or not digits.isdigit():
        return False
    weights = [3, 1, 3, 1, 3, 1, 3]
    total = sum(int(d) * w for d, w in zip(digits[:7], weights))
    check = (10 - total % 10) % 10
    return check == int(digits[7])


def _ean13_valid(digits: str) -> bool:
    if len(digits) != 13 or not digits.isdigit():
        return False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits[:12]))
    check = (10 - total % 10) % 10
    return check == int(digits[12])


def _score_barcode(value: str, *, from_hri: bool = False) -> int:
    digits = _normalize_digits(value)
    if not digits:
        return 0

    score = 0
    if _ean8_valid(digits):
        score = 100
    elif _ean13_valid(digits):
        score = 95
    elif len(digits) == 8:
        score = 62
    elif len(digits) == 9:
        score = 58
    elif len(digits) == 13:
        score = 68 if from_hri else 58
    elif len(digits) == 12:
        score = 22
    elif 6 <= len(digits) <= 20:
        score = 28 if from_hri else 18
    else:
        score = 1

    if len(digits) in (8, 9):
        score += 25
    elif len(digits) == 13:
        score += 18
    elif len(digits) > 14:
        score -= 45

    if from_hri and 8 <= len(digits) <= 13:
        score += 8

    return score


def _pick_best_barcode(codes: list[str], *, hri_flags: list[bool] | None = None) -> str | None:
    best_digits = None
    best_score = -1
    for idx, code in enumerate(codes):
        digits = _normalize_digits(code)
        if not digits:
            continue
        from_hri = bool(hri_flags[idx]) if hri_flags and idx < len(hri_flags) else False
        score = _score_barcode(digits, from_hri=from_hri)
        if score > best_score or (
            score == best_score and best_digits and len(digits) < len(best_digits)
        ):
            best_score = score
            best_digits = digits
    return best_digits


def _append_unique(found: list[str], text: str | None) -> None:
    payload = (text or "").strip()
    if payload and payload not in found:
        found.append(payload)


def _extract_digit_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    if not text:
        return candidates

    normalized = _normalize_digits(text)
    if len(normalized) >= 6:
        _append_unique(candidates, normalized)

    for match in re.finditer(r"(?:\d[\d\s\-]{4,}\d|\d{6,})", text):
        digits = _normalize_digits(match.group())
        if len(digits) >= 6:
            _append_unique(candidates, digits)

    return candidates


def _try_pyzbar_decoder(bgr, found: list[str]) -> None:
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode
    except ImportError:
        return

    import cv2

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    for source in (gray, bgr):
        try:
            for item in pyzbar_decode(source) or []:
                payload = item.data.decode("utf-8", errors="replace").strip()
                _append_unique(found, payload)
        except Exception:
            logger.debug("pyzbar échec", exc_info=True)


def _try_opencv_barcode_detector(bgr, found: list[str]) -> None:
    import cv2

    try:
        detector = cv2.barcode.BarcodeDetector()
        ok, decoded_info, _decoded_type, _points = detector.detectAndDecodeWithType(bgr)
        if ok and decoded_info:
            for item in decoded_info:
                _append_unique(found, item)
        ok, decoded_info, _decoded_type, _points = detector.detectAndDecodeMulti(bgr)
        if ok and decoded_info:
            for item in decoded_info:
                _append_unique(found, item)
        data, _decoded_type, _points = detector.detectAndDecode(bgr)
        _append_unique(found, data)
    except Exception:
        logger.debug("BarcodeDetector échec", exc_info=True)


def _image_variants(bgr, heavy: bool = False):
    """Variantes d'image. Mode lourd = plus de prétraitements pour zones / PDF difficiles."""
    import cv2
    import numpy as np

    variants = [bgr]
    try:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        variants.append(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))

        h, w = gray.shape[:2]
        min_side = max(h, w)
        if min_side < BARCODE_MIN_SIDE_PX:
            scale = BARCODE_MIN_SIDE_PX / min_side
            up = cv2.resize(
                bgr,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_CUBIC,
            )
            variants.append(up)

        if heavy and w < 640:
            scale_x = max(3.0, 640 / max(w, 1))
            stretched = cv2.resize(
                bgr,
                (int(w * scale_x), int(h * max(1.2, scale_x * 0.35))),
                interpolation=cv2.INTER_CUBIC,
            )
            variants.append(stretched)

        if not heavy:
            return variants

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        variants.append(cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR))

        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(cv2.cvtColor(otsu, cv2.COLOR_GRAY2BGR))

        inverted = cv2.bitwise_not(otsu)
        variants.append(cv2.cvtColor(inverted, cv2.COLOR_GRAY2BGR))

        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
        )
        variants.append(cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR))

        sharpen = cv2.filter2D(
            gray,
            -1,
            np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32),
        )
        variants.append(cv2.cvtColor(sharpen, cv2.COLOR_GRAY2BGR))
    except Exception:
        logger.debug("Variantes code-barres en échec", exc_info=True)

    return variants


def decode_barcodes_from_pil(image, heavy: bool = False) -> list[str]:
    """Décode les codes-barres présents dans une image PIL."""
    if image is None:
        return []

    try:
        import cv2  # noqa: F401
        import numpy as np  # noqa: F401
    except ImportError:
        logger.warning("OpenCV indisponible — décodage code-barres impossible.")
        return []

    bgr = _pil_to_bgr(image)
    found: list[str] = []

    variants = _image_variants(bgr, heavy=heavy)
    if not heavy:
        variants.extend(_image_variants(bgr, heavy=True))

    seen_ids = set()
    for variant in variants:
        vid = variant.tobytes()[:128]
        if vid in seen_ids:
            continue
        seen_ids.add(vid)
        _try_pyzbar_decoder(variant, found)
        _try_opencv_barcode_detector(variant, found)

    return found


def _split_pil_vertical(image, top_ratio: float):
    if image is None:
        return None, None
    width, height = image.size
    split_y = max(1, min(height - 1, int(height * top_ratio)))
    return image.crop((0, 0, width, split_y)), image.crop((0, split_y, width, height))


def _ocr_digit_candidates(pil_image) -> list[str]:
    if pil_image is None:
        return []

    from gestion_documentaire.services.ocr_service import run_ocr_on_pil_crop
    from gestion_documentaire.services.ocr_service import _ensure_image_deps

    _fitz, _np, Image = _ensure_image_deps()
    width, height = pil_image.size
    scale = 1
    if max(width, height) < 480:
        scale = max(3, int(480 / max(width, height)))
    if scale > 1:
        pil_image = pil_image.resize((width * scale, height * scale), Image.LANCZOS)

    text, confidence = run_ocr_on_pil_crop(pil_image)
    if confidence < 0.25 and not text.strip():
        return []
    return _extract_digit_candidates(text)


def _native_pdf_digit_candidates(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
) -> list[str]:
    from gestion_documentaire.services.ocr_service import extract_native_text_in_normalized_rect

    text = extract_native_text_in_normalized_rect(file_bytes, filename, page_index, rect)
    if not text:
        return []
    return _extract_digit_candidates(text)


def _collect_from_pil_image(image, heavy: bool, *, allow_hri: bool = True) -> tuple[list[str], list[bool]]:
    codes: list[str] = []
    flags: list[bool] = []

    if image is None:
        return codes, flags

    for value in decode_barcodes_from_pil(image, heavy=heavy):
        _append_unique(codes, value)
        flags.append(False)

    bars_image, hri_image = _split_pil_vertical(image, 1.0 - BARCODE_HRI_ZONE_RATIO)
    if bars_image is not None and bars_image.size != image.size:
        for value in decode_barcodes_from_pil(bars_image, heavy=True):
            _append_unique(codes, value)
            flags.append(False)

    if allow_hri and not codes:
        for target in (hri_image, image):
            for value in _ocr_digit_candidates(target):
                _append_unique(codes, value)
                flags.append(True)

    return codes, flags


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


def _render_page_for_barcode(file_bytes: bytes, filename: str, page_index: int, zoom: float | None = None):
    from gestion_documentaire.services.ocr_service import (
        PDF_EXTENSIONS,
        _ensure_image_deps,
        _extension_from_name,
    )

    zoom = zoom if zoom is not None else BARCODE_PDF_ZOOMS[0]
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        return _render_pdf_page(file_bytes, page_index, zoom)

    if page_index > 0:
        return None

    with Image.open(io.BytesIO(file_bytes)) as image:
        return image.convert("RGB")


def _render_zone_for_barcode(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
    zoom: float | None = None,
    margin: float | None = None,
):
    from gestion_documentaire.services.ocr_service import (
        PDF_EXTENSIONS,
        _ensure_image_deps,
        _extension_from_name,
        render_zone_clip_as_pil,
    )

    zoom = zoom if zoom is not None else BARCODE_PDF_ZOOMS[-1]
    margin = BARCODE_ZONE_MARGIN if margin is None else margin
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        return _render_pdf_zone(file_bytes, page_index, rect, zoom, margin)

    return render_zone_clip_as_pil(
        file_bytes,
        filename,
        page_index,
        rect,
        margin=margin,
    )


def _decode_with_zoom_retries(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict | None = None,
) -> list[str]:
    """Essaie plusieurs zooms et stratégies (barres + texte HRI) dans la zone."""
    from gestion_documentaire.services.ocr_service import PDF_EXTENSIONS, _extension_from_name

    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    zooms = BARCODE_PDF_ZOOMS if is_pdf else (1.0, 2.0, 3.0)
    heavy = rect is not None
    all_codes: list[str] = []
    hri_flags: list[bool] = []

    margins = (BARCODE_ZONE_MARGIN, 0.1) if rect is not None else (0.0,)

    if rect is not None:
        for value in _native_pdf_digit_candidates(file_bytes, filename, page_index, rect):
            _append_unique(all_codes, value)
            hri_flags.append(True)

    for margin in margins:
        decoded_any = False
        for zoom in zooms:
            try:
                if rect is not None:
                    image = _render_zone_for_barcode(
                        file_bytes, filename, page_index, rect, zoom=zoom, margin=margin
                    )
                else:
                    image = _render_page_for_barcode(file_bytes, filename, page_index, zoom=zoom)

                batch, batch_flags = _collect_from_pil_image(
                    image,
                    heavy=heavy,
                    allow_hri=not decoded_any,
                )
                for value, flag in zip(batch, batch_flags):
                    if value not in all_codes:
                        all_codes.append(value)
                        hri_flags.append(flag)
                        if not flag:
                            decoded_any = True
            except Exception:
                logger.debug("Zoom code-barres %.1f échoué", zoom, exc_info=True)

        if decoded_any:
            break

        if rect is not None and not all_codes:
            for zoom in zooms[:2]:
                try:
                    image = _render_zone_for_barcode(
                        file_bytes, filename, page_index, rect, zoom=zoom, margin=margin
                    )
                    batch, batch_flags = _collect_from_pil_image(image, heavy=True, allow_hri=True)
                    for value, flag in zip(batch, batch_flags):
                        if value not in all_codes:
                            all_codes.append(value)
                            hri_flags.append(flag)
                except Exception:
                    logger.debug("Repli HRI code-barres échoué", exc_info=True)
            if all_codes:
                break

    if not all_codes:
        return []

    best = _pick_best_barcode(all_codes, hri_flags=hri_flags)
    return [best] if best else []


def extract_barcode_field_values(
    champs,
    file_obj: BinaryIO,
    filename: str = "",
    ocr_pages: set[int] | None = None,
) -> list[dict]:
    """
    Extrait le contenu des champs de type « code_barre ».
    - Avec zone : décode le rectangle (barres + repli OCR sur les chiffres imprimés).
    - Sans zone : scanne les premières pages du document.
    """
    from gestion_documentaire.services.ocr_service import (
        _read_file_bytes,
        get_page_count_from_bytes,
    )

    barcode_champs = [c for c in champs if _is_barcode_champ(c)]
    if not barcode_champs:
        return []

    file_bytes = _read_file_bytes(file_obj)
    extracted: list[dict] = []
    used_payloads: set[str] = set()

    zone_champs = [c for c in barcode_champs if _champ_has_zone(c)]
    free_champs = [c for c in barcode_champs if not _champ_has_zone(c)]

    for champ in zone_champs:
        page_index = int(champ.capture_page or 0)
        if ocr_pages is not None and page_index not in ocr_pages:
            continue
        rect = _normalized_rect(champ)
        try:
            codes = _decode_with_zoom_retries(file_bytes, filename, page_index, rect=rect)
            if codes:
                payload = codes[0]
                extracted.append({
                    "champ_id": champ.id,
                    "valeur": payload[:4000],
                    "confidence": 1.0,
                    "methode": "code_barre_zone",
                })
                used_payloads.add(payload)
        except Exception:
            logger.exception("Erreur décodage code-barres zone champ %s", champ.id)

    if not free_champs:
        return extracted

    page_count = get_page_count_from_bytes(file_bytes, filename)
    pages_to_scan: list[int] = []
    for page_index in range(min(page_count, BARCODE_MAX_PAGES)):
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
            logger.exception("Erreur décodage code-barres page %s", page_index)

    for champ, payload in zip(free_champs, page_codes):
        extracted.append({
            "champ_id": champ.id,
            "valeur": payload[:4000],
            "confidence": 0.95,
            "methode": "code_barre_page",
        })
        used_payloads.add(payload)

    return extracted
