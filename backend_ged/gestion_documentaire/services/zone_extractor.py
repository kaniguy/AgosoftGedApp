"""Extraction des valeurs de champs par zones de capture (style Dokmee Capture)."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import BinaryIO

from gestion_documentaire.services.field_extractor import _format_value_for_type
from gestion_documentaire.services.ocr_service import (
    OCR_MIN_ZONE_CONFIDENCE,
    ZONE_CROP_MARGIN,
    ZONE_CROP_RETRY_MARGIN,
    build_ocr_result_from_page_cache,
    extract_native_text_in_normalized_rect,
    extract_text_from_cropped_image,
    extract_zone_text_ocr,
    filter_ocr_lines_in_rect,
    page_is_scanned,
    render_page_as_pil,
    run_ocr_on_pil_image,
)
from gestion_documentaire.services.zone_text_refine import (
    assemble_crop_text,
    refine_raw_for_champ,
    score_zone_extraction,
)

logger = logging.getLogger(__name__)


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


def _try_native_zone_text(file_bytes: bytes, filename: str, champ, rect: dict) -> tuple[str, float, str] | None:
    page_index = int(champ.capture_page or 0)
    native_text = extract_native_text_in_normalized_rect(
        file_bytes,
        filename,
        page_index,
        rect,
    )
    if native_text and native_text.strip():
        refined = refine_raw_for_champ(native_text.strip(), champ)
        if refined:
            return refined, 1.0, "pdf_native_zone"
    return None


def _extract_from_page_ocr(ocr_lines: list[dict], champ, rect: dict) -> tuple[str, float]:
    for margin in (ZONE_CROP_MARGIN, ZONE_CROP_RETRY_MARGIN):
        matching = filter_ocr_lines_in_rect(ocr_lines, rect, margin=margin)
        if not matching:
            continue
        raw_value, confidence = assemble_crop_text(matching, champ)
        refined = refine_raw_for_champ(raw_value, champ)
        if refined:
            return refined, confidence
    return "", 0.0


def _ocr_zone_crop(page_image, champ, rect: dict) -> tuple[str, float, str]:
    """OCR sur crop (page déjà rendue) — choisit la meilleure marge."""
    best_text = ""
    best_conf = 0.0
    best_score = -1.0

    for margin in (ZONE_CROP_MARGIN, ZONE_CROP_RETRY_MARGIN):
        raw_value, confidence = extract_text_from_cropped_image(
            page_image,
            rect,
            enhance=True,
            margin=margin,
            champ=champ,
        )
        refined = refine_raw_for_champ(raw_value, champ)
        if not refined:
            continue
        score = score_zone_extraction(refined, confidence, champ)
        if score > best_score:
            best_text = refined
            best_conf = confidence
            best_score = score

    if not best_text:
        return "", 0.0, "none"
    return best_text, best_conf, "ocr_zone_crop"


def _ocr_zone_clip(file_bytes: bytes, filename: str, page_index: int, champ, rect: dict) -> tuple[str, float, str]:
    """OCR sur clip PDF (page scannée / image) — sans rendre la page entière."""
    best_text = ""
    best_conf = 0.0
    best_score = -1.0

    for margin in (ZONE_CROP_MARGIN, ZONE_CROP_RETRY_MARGIN):
        raw_value, confidence = extract_zone_text_ocr(
            file_bytes,
            filename,
            page_index,
            rect,
            champ=champ,
            margin=margin,
        )
        refined = refine_raw_for_champ(raw_value, champ)
        if not refined:
            continue
        score = score_zone_extraction(refined, confidence, champ)
        if score > best_score:
            best_text = refined
            best_conf = confidence
            best_score = score

    if not best_text:
        return "", 0.0, "none"
    return best_text, best_conf, "ocr_zone_clip"


def _append_zone_result(extracted: list[dict], champ, raw_value: str, confidence: float, method: str) -> None:
    if not raw_value or confidence < OCR_MIN_ZONE_CONFIDENCE:
        return
    valeur = _format_value_for_type(raw_value, champ)
    if not valeur:
        return
    extracted.append({
        "champ_id": champ.id,
        "valeur": valeur,
        "confidence": round(confidence, 2),
        "methode": method,
    })


def extract_field_values_by_zones(
    champs,
    file_obj: BinaryIO,
    filename: str = "",
    type_document=None,
    ocr_pages: set[int] | None = None,
) -> tuple[list[dict], dict]:
    """
    Extrait les valeurs des champs disposant d'une zone de capture configurée.

  - Pages PDF textuelles : 1 OCR page entière puis affectation aux zones (rapide, précis).
  - Pages scannées / images ajoutées : OCR par clip de zone uniquement (évite le rendu complet).
  - ocr_pages : limite l'extraction aux pages indiquées (ré-extraction partielle).
    """
    from gestion_documentaire.services.ocr_service import _read_file_bytes

    file_bytes = _read_file_bytes(file_obj)
    extracted: list[dict] = []

    zones_by_page: dict[int, list] = defaultdict(list)
    for champ in champs:
        if getattr(champ, "type_champ", None) in ("qr", "code_barre"):
            continue
        if not _champ_has_zone(champ):
            continue
        page_index = int(champ.capture_page or 0)
        if ocr_pages is not None and page_index not in ocr_pages:
            continue
        zones_by_page[page_index].append(champ)

    page_image_cache: dict[int, object] = {}
    page_ocr_cache: dict[int, list] = {}

    def _get_page_image(page_index: int):
        if page_index not in page_image_cache:
            page_image_cache[page_index] = render_page_as_pil(file_bytes, filename, page_index)
        return page_image_cache[page_index]

    def _get_page_ocr_lines(page_index: int, page_image) -> list[dict]:
        if page_index not in page_ocr_cache:
            started = time.perf_counter()
            page_ocr_cache[page_index] = run_ocr_on_pil_image(page_image)
            elapsed = time.perf_counter() - started
            logger.info(
                "OCR page %s : %d lignes en %.1fs",
                page_index,
                len(page_ocr_cache[page_index]),
                elapsed,
            )
        return page_ocr_cache[page_index]

    for page_index, page_champs in zones_by_page.items():
        pending_page_ocr: list = []

        for champ in page_champs:
            rect = _normalized_rect(champ)
            try:
                native = _try_native_zone_text(file_bytes, filename, champ, rect)
                if native:
                    raw_value, confidence, method = native
                    _append_zone_result(extracted, champ, raw_value, confidence, method)
                    continue
                pending_page_ocr.append(champ)
            except Exception:
                logger.exception("Erreur extraction zone pour le champ %s", champ.id)

        if not pending_page_ocr:
            continue

        page_image = _get_page_image(page_index)
        if page_image is None:
            for champ in pending_page_ocr:
                rect = _normalized_rect(champ)
                try:
                    raw_value, confidence, method = _ocr_zone_clip(
                        file_bytes, filename, page_index, champ, rect
                    )
                    _append_zone_result(extracted, champ, raw_value, confidence, method)
                except Exception:
                    logger.exception("Erreur OCR clip pour le champ %s", champ.id)
            continue

        scanned = page_is_scanned(file_bytes, filename, page_index)
        ocr_lines = _get_page_ocr_lines(page_index, page_image)
        pending_fallback: list = []

        for champ in pending_page_ocr:
            rect = _normalized_rect(champ)
            try:
                raw_value, confidence = _extract_from_page_ocr(ocr_lines, champ, rect)
                if raw_value and confidence >= OCR_MIN_ZONE_CONFIDENCE:
                    _append_zone_result(extracted, champ, raw_value, confidence, "ocr_zone_page")
                else:
                    pending_fallback.append(champ)
            except Exception:
                logger.exception("Erreur affectation OCR page pour le champ %s", champ.id)
                pending_fallback.append(champ)

        for champ in pending_fallback:
            rect = _normalized_rect(champ)
            try:
                if scanned:
                    started = time.perf_counter()
                    raw_value, confidence, method = _ocr_zone_clip(
                        file_bytes, filename, page_index, champ, rect
                    )
                    elapsed = time.perf_counter() - started
                    logger.info(
                        "OCR clip champ %s page %s en %.1fs",
                        champ.id,
                        page_index,
                        elapsed,
                    )
                else:
                    raw_value, confidence, method = _ocr_zone_crop(page_image, champ, rect)
                _append_zone_result(extracted, champ, raw_value, confidence, method)
            except Exception:
                logger.exception("Erreur OCR repli zone pour le champ %s", champ.id)

    ocr_cache = build_ocr_result_from_page_cache(page_ocr_cache)
    return extracted, {"active": False, "pages": {}}, ocr_cache


def count_configured_zones(champs) -> int:
    return sum(1 for champ in champs if _champ_has_zone(champ))
