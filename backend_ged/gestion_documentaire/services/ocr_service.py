"""Service OCR basé sur PaddleOCR pour extraire le texte des documents."""

from __future__ import annotations

import io
import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.request
import warnings
from typing import BinaryIO

# Évite un bug oneDNN sur Windows avec PaddlePaddle 3.x
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

# Avertissement ccache sans impact sur Windows — peut être ignoré
warnings.filterwarnings("ignore", message=".*ccache.*", category=UserWarning)

logger = logging.getLogger(__name__)

_fitz = None
_np = None
_Image = None
_image_deps_error: str | None = None


def _ensure_image_deps():
    """Charge PyMuPDF / Pillow / numpy à la demande (évite un crash au démarrage Django)."""
    global _fitz, _np, _Image, _image_deps_error
    if _fitz is not None:
        return _fitz, _np, _Image
    if _image_deps_error is not None:
        raise ImportError(_image_deps_error)
    try:
        import fitz
        import numpy as np
        from PIL import Image

        _fitz, _np, _Image = fitz, np, Image
        return fitz, np, Image
    except ImportError as exc:
        _image_deps_error = (
            "Dépendances OCR manquantes (PyMuPDF, Pillow, numpy). "
            "Installez-les avec : pip install -r requirements.txt "
            "dans l'environnement django_env."
        )
        raise ImportError(_image_deps_error) from exc

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}
PDF_EXTENSIONS = {".pdf"}

# Réglages performance — mode libellé (sans zones)
# PDF natif : peu coûteux → plusieurs pages pour trouver les champs hors page 1
# OCR image : coûteux → plafond plus bas, mais > 1 pour le multi-pages
OCR_MAX_PAGES_NATIVE = 50
OCR_MAX_PAGES_OCR = 3
# Alias rétrocompat (anciens imports / docs)
OCR_MAX_PAGES = OCR_MAX_PAGES_OCR
OCR_PDF_ZOOM = 1.2
OCR_MAX_IMAGE_SIDE = 1400
OCR_DET_LIMIT_SIDE_LEN = 960
OCR_MIN_NATIVE_TEXT_CHARS = 60
OCR_MIN_ZONE_CONFIDENCE = 0.32
ZONE_CROP_MARGIN = 0.006
ZONE_CROP_RETRY_MARGIN = 0.012
ZONE_OCR_MARGIN = ZONE_CROP_MARGIN
MIN_CROP_SIDE_PX = 56

_ocr_instance = None
_ocr_unavailable_reason: str | None = None
_ocr_lock = threading.Lock()


def _use_remote_ocr() -> bool:
    """True dans les workers Gunicorn : PaddleOCR tourne dans ocr_worker."""
    if str(os.environ.get("OCR_IN_WORKER", "")).lower() in ("1", "true", "yes"):
        return False
    return bool((os.environ.get("OCR_WORKER_URL") or "").strip())


def _ocr_worker_url() -> str:
    return (os.environ.get("OCR_WORKER_URL") or "").rstrip("/")


def _worker_is_up() -> bool:
    url = _ocr_worker_url()
    if not url:
        return False
    try:
        with urllib.request.urlopen(f"{url}/health", timeout=2) as resp:
            payload = json.loads(resp.read() or b"{}")
        return bool(payload.get("ok"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False


def is_ocr_available() -> bool:
    if _use_remote_ocr():
        return _worker_is_up()
    return _get_ocr_engine() is not None


def get_ocr_unavailable_reason() -> str | None:
    if _use_remote_ocr():
        if _worker_is_up():
            return None
        return "processus OCR dédié injoignable"
    _get_ocr_engine()
    return _ocr_unavailable_reason


def _ocr_lines_via_worker(image_np) -> list[dict]:
    """Envoie une image au processus OCR (les workers HTTP restent libres)."""
    fitz, np, Image = _ensure_image_deps()
    buf = io.BytesIO()
    Image.fromarray(image_np).save(buf, format="PNG")
    png_bytes = buf.getvalue()
    url = f"{_ocr_worker_url()}/predict"
    timeout = int(os.environ.get("OCR_WORKER_TIMEOUT", "180"))
    retries = int(os.environ.get("OCR_WORKER_RETRIES", "20"))

    last_error = "OCR indisponible"
    for attempt in range(max(1, retries)):
        req = urllib.request.Request(
            url,
            data=png_bytes,
            headers={"Content-Type": "image/png"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as exc:
            body = exc.read() if exc.fp else b"{}"
            try:
                payload = json.loads(body or b"{}")
            except json.JSONDecodeError:
                payload = {}
            last_error = payload.get("error") or f"OCR HTTP {exc.code}"
            if exc.code == 503 and attempt + 1 < retries:
                time.sleep(1.5)
                continue
            raise RuntimeError(f"OCR indisponible : {last_error}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
            if attempt + 1 < retries:
                time.sleep(2)
                continue
            raise RuntimeError(
                "OCR indisponible : processus dédié injoignable"
            ) from exc

        if not payload.get("ok"):
            last_error = payload.get("error") or "échec OCR"
            raise RuntimeError(f"OCR indisponible : {last_error}")
        return payload.get("lines") or []

    raise RuntimeError(f"OCR indisponible : {last_error}")


def _ocr_lines_local(image_np) -> list[dict]:
    """Exécute PaddleOCR dans le process courant (ocr_worker ou runserver)."""
    ocr_engine = _get_ocr_engine()
    if ocr_engine is None:
        reason = _ocr_unavailable_reason or "PaddleOCR non disponible"
        raise RuntimeError(f"OCR indisponible : {reason}")
    height, width = image_np.shape[:2]
    result = ocr_engine.predict(image_np)
    return _parse_ocr_result_detailed(result, width, height)


def _ocr_lines_from_numpy(image_np) -> list[dict]:
    if image_np is None or getattr(image_np, "size", 0) == 0:
        return []
    if _use_remote_ocr():
        return _ocr_lines_via_worker(image_np)
    return _ocr_lines_local(image_np)


def _get_ocr_engine():
    global _ocr_instance, _ocr_unavailable_reason
    if _ocr_instance is not None:
        return _ocr_instance
    if _ocr_unavailable_reason is not None:
        return None

    with _ocr_lock:
        if _ocr_instance is not None:
            return _ocr_instance
        if _ocr_unavailable_reason is not None:
            return None
        try:
            import logging as _logging

            for logger_name in ("ppocr", "paddlex", "paddle"):
                _logging.getLogger(logger_name).setLevel(_logging.WARNING)

            from paddleocr import PaddleOCR

            logger.info("Initialisation PaddleOCR (une seule fois au démarrage)…")
            _ocr_instance = PaddleOCR(
                text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
                use_textline_orientation=False,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                enable_mkldnn=False,
                text_det_limit_side_len=OCR_DET_LIMIT_SIDE_LEN,
            )
            logger.info("PaddleOCR prêt — modèles PP-OCRv5 mobile (det + rec latin)")
            return _ocr_instance
        except Exception as exc:
            _ocr_unavailable_reason = str(exc)
            logger.exception("Impossible d'initialiser PaddleOCR")
            return None


def _extension_from_name(name: str) -> str:
    if not name:
        return ""
    dot = name.rfind(".")
    if dot == -1:
        return ""
    return name[dot:].lower()


def _pil_to_numpy(image):
    fitz, np, Image = _ensure_image_deps()
    if image.mode != "RGB":
        image = image.convert("RGB")
    return np.array(image)


def _resize_for_ocr(image):
    fitz, np, Image = _ensure_image_deps()
    width, height = image.size
    longest = max(width, height)
    if longest <= OCR_MAX_IMAGE_SIDE:
        return image
    scale = OCR_MAX_IMAGE_SIDE / longest
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def _page_native_char_count(file_bytes: bytes, filename: str, page_index: int) -> int:
    """Nombre de caractères textuels natifs sur une page (0 = page scannée / image)."""
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    if not is_pdf:
        return 0

    fitz, np, Image = _ensure_image_deps()
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if page_index < 0 or page_index >= len(doc):
            return 0
        text = doc[page_index].get_text("text") or ""
        return len(re.sub(r"\s+", "", text))
    finally:
        doc.close()


def page_is_scanned(file_bytes: bytes, filename: str, page_index: int, threshold: int = 25) -> bool:
    """True si la page ne contient pas de texte PDF natif exploitable."""
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    if not is_pdf:
        return page_index == 0
    return _page_native_char_count(file_bytes, filename, page_index) < threshold


def _lines_from_text_block(text: str) -> list[dict]:
    lines: list[dict] = []
    for index, raw_line in enumerate(text.splitlines()):
        line = raw_line.strip()
        if not line:
            continue
        lines.append({"text": line, "confidence": 1.0, "y": float(index)})
    return lines


def _try_extract_pdf_native_text(
    file_bytes: bytes,
    max_pages: int = OCR_MAX_PAGES_NATIVE,
) -> dict | None:
    """Extraction instantanée si le PDF contient du texte sélectionnable (multi-pages)."""
    fitz, np, Image = _ensure_image_deps()
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        page_count = min(len(doc), max_pages)
        all_lines: list[dict] = []
        y_offset = 0.0

        for page_index in range(page_count):
            page_text = doc[page_index].get_text("text") or ""
            page_lines = _lines_from_text_block(page_text)
            for line in page_lines:
                all_lines.append({
                    **line,
                    "y": y_offset + line["y"],
                    "page": page_index,
                })
            y_offset += 1000.0

        full_text = "\n".join(line["text"] for line in all_lines)
        meaningful_chars = len(re.sub(r"\s+", "", full_text))
        if meaningful_chars < OCR_MIN_NATIVE_TEXT_CHARS:
            return None

        return {
            "lines": all_lines,
            "full_text": full_text,
            "page_count": page_count,
            "method": "pdf_native",
        }
    finally:
        doc.close()


def _pdf_pages_to_images(file_bytes: bytes, max_pages: int = OCR_MAX_PAGES_OCR) -> list:
    fitz, np, Image = _ensure_image_deps()
    images: list = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        matrix = fitz.Matrix(OCR_PDF_ZOOM, OCR_PDF_ZOOM)
        for page_index in range(min(len(doc), max_pages)):
            page = doc[page_index]
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            images.append(_pil_to_numpy(_resize_for_ocr(image)))
    finally:
        doc.close()
    return images


def _image_file_to_numpy(file_bytes: bytes):
    fitz, np, Image = _ensure_image_deps()
    with Image.open(io.BytesIO(file_bytes)) as image:
        return _pil_to_numpy(_resize_for_ocr(image))


def _read_file_bytes(file_obj: BinaryIO) -> bytes:
    file_bytes = file_obj.read()
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    return file_bytes


def _collect_images(file_bytes: bytes, filename: str) -> list:
    ext = _extension_from_name(filename)
    if ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF":
        return _pdf_pages_to_images(file_bytes)
    if ext in SUPPORTED_IMAGE_EXTENSIONS:
        return [_image_file_to_numpy(file_bytes)]
    raise ValueError("Format non supporté pour l'OCR. Utilisez un PDF ou une image.")


def _poly_to_norm_bbox(poly, image_width: int, image_height: int) -> dict:
    """Convertit un polygone OCR en bbox normalisée + centre."""
    if not poly or image_width <= 0 or image_height <= 0:
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "cx": 0.0, "cy": 0.0}
    try:
        xs = [float(point[0]) for point in poly]
        ys = [float(point[1]) for point in poly]
    except (TypeError, IndexError, ValueError):
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "cx": 0.0, "cy": 0.0}
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    return {
        "x": x0 / image_width,
        "y": y0 / image_height,
        "width": max(0.0, (x1 - x0) / image_width),
        "height": max(0.0, (y1 - y0) / image_height),
        "cx": (x0 + x1) / 2 / image_width,
        "cy": (y0 + y1) / 2 / image_height,
    }


def _parse_ocr_result_detailed(result, image_width: int, image_height: int) -> list[dict]:
    """Normalise la sortie PaddleOCR en lignes {text, confidence, y, cx, cy, bbox}."""
    lines: list[dict] = []
    if not result or image_width <= 0 or image_height <= 0:
        return lines

    for page in result:
        if page is None:
            continue

        if hasattr(page, "json"):
            payload = page.json.get("res", page.json) if isinstance(page.json, dict) else {}
            rec_texts = payload.get("rec_texts") or []
            rec_scores = payload.get("rec_scores") or []
            rec_polys = payload.get("rec_polys") or payload.get("dt_polys") or []

            for index, text in enumerate(rec_texts):
                text = str(text).strip()
                if not text:
                    continue
                confidence = float(rec_scores[index]) if index < len(rec_scores) else 0.0
                poly = rec_polys[index] if index < len(rec_polys) else None
                bbox = _poly_to_norm_bbox(poly, image_width, image_height)
                lines.append({
                    "text": text,
                    "confidence": confidence,
                    "y": bbox["cy"] * image_height,
                    "cx": bbox["cx"],
                    "cy": bbox["cy"],
                    "bbox": bbox,
                })
            continue

        if isinstance(page, list):
            for item in page:
                if not item or len(item) < 2:
                    continue
                box, text_info = item[0], item[1]
                if not text_info:
                    continue
                text = str(text_info[0]).strip()
                if not text:
                    continue
                confidence = float(text_info[1]) if len(text_info) > 1 else 0.0
                bbox = _poly_to_norm_bbox(box, image_width, image_height)
                lines.append({
                    "text": text,
                    "confidence": confidence,
                    "y": bbox["cy"] * image_height,
                    "cx": bbox["cx"],
                    "cy": bbox["cy"],
                    "bbox": bbox,
                })

    lines.sort(key=lambda row: (row["cy"], row["cx"]))
    return lines


def _point_in_norm_rect(cx: float, cy: float, rect: dict, margin: float = ZONE_OCR_MARGIN) -> bool:
    """Indique si un point (normalisé) tombe dans un rectangle."""
    return (
        rect["x"] - margin <= cx <= rect["x"] + rect["width"] + margin
        and rect["y"] - margin <= cy <= rect["y"] + rect["height"] + margin
    )


def _expand_rect(rect: dict, margin: float = ZONE_OCR_MARGIN) -> dict:
    """Élargit légèrement une zone normalisée pour tolérer un léger décalage."""
    x = max(0.0, rect["x"] - margin)
    y = max(0.0, rect["y"] - margin)
    width = min(1.0 - x, rect["width"] + 2 * margin)
    height = min(1.0 - y, rect["height"] + 2 * margin)
    return {"x": x, "y": y, "width": width, "height": height}


def _enhance_crop_image(crop):
    """Améliore le contraste d'un crop avant OCR (petites zones)."""
    fitz, np, Image = _ensure_image_deps()
    from PIL import ImageEnhance

    enhanced = ImageEnhance.Contrast(crop.convert("RGB")).enhance(1.6)
    return enhanced


def run_ocr_on_pil_image(image) -> list[dict]:
    """Exécute l'OCR sur une image PIL et retourne les lignes avec positions."""
    width, height = image.size
    if width <= 0 or height <= 0:
        return []

    image_np = _pil_to_numpy(_resize_for_ocr(image))
    lines = _ocr_lines_from_numpy(image_np)
    # Coordonnées déjà normalisées 0–1 sur l'image redimensionnée (identique à l'origine).
    return lines


def filter_ocr_lines_in_rect(
    ocr_lines: list[dict],
    rect: dict,
    margin: float = ZONE_CROP_MARGIN,
) -> list[dict]:
    """Retourne les lignes OCR dont le centre tombe dans la zone (coordonnées normalisées)."""
    expanded = _expand_rect(rect, margin)
    matching = [
        line for line in ocr_lines
        if _point_in_norm_rect(line.get("cx", 0.0), line.get("cy", 0.0), expanded, margin=0.0)
    ]
    matching.sort(key=lambda row: (row.get("cy", 0.0), row.get("cx", 0.0)))
    return matching


def build_ocr_result_from_page_cache(page_ocr_cache: dict[int, list]) -> dict:
    """Construit un résultat OCR réutilisable pour le repli par libellé (évite un 2e passage complet)."""
    if not page_ocr_cache:
        return {}

    all_lines: list[dict] = []
    for page_index in sorted(page_ocr_cache.keys()):
        all_lines.extend(page_ocr_cache[page_index])

    deduped = _dedupe_lines(all_lines)
    return {
        "lines": deduped,
        "full_text": "\n".join(line["text"] for line in deduped),
        "page_count": len(page_ocr_cache),
        "method": "ocr_page_cache",
    }


def _lines_text_in_rect(ocr_lines: list[dict], rect: dict) -> tuple[str, float]:
    """Concatène les lignes OCR dont le centre est dans la zone."""
    matching = filter_ocr_lines_in_rect(ocr_lines, rect)
    if not matching:
        return "", 0.0

    texts = [line["text"] for line in matching if line.get("text")]
    confidences = [line.get("confidence", 0.0) for line in matching]
    full_text = " ".join(texts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return full_text, avg_conf


def extract_zone_texts_from_page(page_image, zones: list[dict]) -> dict[int, tuple[str, float, str]]:
    """
    Un seul OCR par page, puis affectation du texte à chaque zone.
    zones: [{champ_id, rect}, ...]
    Retourne {champ_id: (texte, confiance, methode)}.
    """
    results: dict[int, tuple[str, float, str]] = {}
    if not page_image or not zones:
        return results

    ocr_lines = run_ocr_on_pil_image(page_image)
    pending_crop: list[dict] = []

    for zone in zones:
        champ_id = zone["champ_id"]
        rect = zone["rect"]
        text, confidence = _lines_text_in_rect(ocr_lines, rect)
        if text and confidence >= OCR_MIN_ZONE_CONFIDENCE:
            results[champ_id] = (text, confidence, "ocr_zone_page")
        else:
            pending_crop.append(zone)

    for zone in pending_crop:
        champ_id = zone["champ_id"]
        text, confidence = extract_text_from_cropped_image(
            page_image,
            _expand_rect(zone["rect"]),
            enhance=True,
        )
        if text and confidence >= OCR_MIN_ZONE_CONFIDENCE:
            results[champ_id] = (text, confidence, "ocr_zone_crop")

    return results


def _parse_ocr_result(result) -> list[dict]:
    """Normalise la sortie PaddleOCR 2.x / 3.x en lignes {text, confidence, y}."""
    lines: list[dict] = []
    if not result:
        return lines

    for page in result:
        if page is None:
            continue

        if hasattr(page, "json"):
            payload = page.json.get("res", page.json) if isinstance(page.json, dict) else {}
            rec_texts = payload.get("rec_texts") or []
            rec_scores = payload.get("rec_scores") or []
            rec_polys = payload.get("rec_polys") or payload.get("dt_polys") or []

            for index, text in enumerate(rec_texts):
                text = str(text).strip()
                if not text:
                    continue
                confidence = float(rec_scores[index]) if index < len(rec_scores) else 0.0
                y_center = 0.0
                if index < len(rec_polys) and rec_polys[index] is not None:
                    poly = rec_polys[index]
                    try:
                        y_center = sum(point[1] for point in poly) / len(poly)
                    except (TypeError, ZeroDivisionError):
                        y_center = 0.0
                lines.append({"text": text, "confidence": confidence, "y": y_center})
            continue

        if isinstance(page, list):
            for item in page:
                if not item or len(item) < 2:
                    continue
                box, text_info = item[0], item[1]
                if not text_info:
                    continue
                text = str(text_info[0]).strip()
                if not text:
                    continue
                confidence = float(text_info[1]) if len(text_info) > 1 else 0.0
                y_center = sum(point[1] for point in box) / len(box) if box else 0.0
                lines.append({"text": text, "confidence": confidence, "y": y_center})

    lines.sort(key=lambda row: (row["y"], row["text"]))
    return lines


def _run_ocr_on_image(ocr_engine, image) -> list[dict]:
    return _ocr_lines_from_numpy(image)


def _dedupe_lines(lines: list[dict]) -> list[dict]:
    deduped: list[dict] = []
    seen: set[str] = set()
    for line in lines:
        key = re.sub(r"\s+", " ", line["text"].strip().lower())
        if key and key not in seen:
            seen.add(key)
            deduped.append(line)
    return deduped


def extract_text_from_file(file_obj: BinaryIO, filename: str = "") -> dict:
    """
    Extrait le texte d'un fichier (PDF ou image).
    Les PDF numériques passent par extraction native (rapide), les scans par PaddleOCR.
    """
    file_bytes = _read_file_bytes(file_obj)
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        native_result = _try_extract_pdf_native_text(file_bytes)
        if native_result:
            logger.info("Extraction PDF native (%s caractères)", len(native_result["full_text"]))
            return native_result

    content_type = getattr(file_obj, "content_type", "") or ""
    if is_pdf or content_type == "application/pdf":
        images = _pdf_pages_to_images(file_bytes)
    elif ext in SUPPORTED_IMAGE_EXTENSIONS or content_type.startswith("image/"):
        images = [_image_file_to_numpy(file_bytes)]
    else:
        raise ValueError("Format non supporté pour l'OCR. Utilisez un PDF ou une image.")

    if not images:
        return {"lines": [], "full_text": "", "page_count": 0, "method": "ocr"}

    all_lines: list[dict] = []
    for image in images:
        all_lines.extend(_ocr_lines_from_numpy(image))

    deduped = _dedupe_lines(all_lines)
    full_text = "\n".join(line["text"] for line in deduped)
    return {
        "lines": deduped,
        "full_text": full_text,
        "page_count": len(images),
        "method": "ocr",
    }


def get_page_count_from_bytes(file_bytes: bytes, filename: str = "") -> int:
    """Retourne le nombre de pages d'un PDF ou 1 pour une image."""
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    if not is_pdf:
        return 1

    fitz, np, Image = _ensure_image_deps()
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        return len(doc)
    finally:
        doc.close()


def render_zone_clip_as_pil(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
    margin: float = ZONE_CROP_MARGIN,
):
    """
    Rend uniquement le rectangle d'une zone (clip PDF) au lieu de la page entière.
    Beaucoup plus rapide pour les pages ajoutées sous forme d'images haute résolution.
    """
    fitz, np, Image = _ensure_image_deps()
    crop_rect = _expand_rect(rect, margin) if margin > 0 else rect
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
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
            matrix = fitz.Matrix(OCR_PDF_ZOOM, OCR_PDF_ZOOM)
            pixmap = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
            if pixmap.width <= 0 or pixmap.height <= 0:
                return None
            return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        finally:
            doc.close()

    if page_index > 0:
        return None

    with Image.open(io.BytesIO(file_bytes)) as image:
        full = image.convert("RGB")
    width, height = full.size
    left = max(0, int(crop_rect["x"] * width))
    top = max(0, int(crop_rect["y"] * height))
    right = min(width, int((crop_rect["x"] + crop_rect["width"]) * width))
    bottom = min(height, int((crop_rect["y"] + crop_rect["height"]) * height))
    if right <= left or bottom <= top:
        return None
    return full.crop((left, top, right, bottom))


def run_ocr_on_pil_crop(crop, champ=None) -> tuple[str, float]:
    """OCR sur une image déjà découpée (zone de capture)."""
    crop = _prepare_crop_for_ocr(crop)
    crop = _enhance_crop_image(crop)
    crop_np = _pil_to_numpy(_resize_for_ocr(crop))
    lines = _ocr_lines_from_numpy(crop_np)
    if not lines:
        return "", 0.0

    if champ is not None:
        from gestion_documentaire.services.zone_text_refine import assemble_crop_text
        return assemble_crop_text(lines, champ)

    return _dominant_row_text(lines)


def extract_zone_text_ocr(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
    champ=None,
    margin: float = ZONE_CROP_MARGIN,
) -> tuple[str, float]:
    """Rend la zone (clip) puis exécute l'OCR — sans charger la page entière."""
    crop = render_zone_clip_as_pil(file_bytes, filename, page_index, rect, margin=margin)
    if crop is None:
        return "", 0.0
    return run_ocr_on_pil_crop(crop, champ)


def render_page_as_pil(file_bytes: bytes, filename: str, page_index: int = 0):
    """
    Rend une page de document en image PIL (même zoom que l'OCR).
    Retourne None si la page est introuvable.
    """
    fitz, np, Image = _ensure_image_deps()
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"

    if is_pdf:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        try:
            if page_index < 0 or page_index >= len(doc):
                return None
            page = doc[page_index]
            matrix = fitz.Matrix(OCR_PDF_ZOOM, OCR_PDF_ZOOM)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        finally:
            doc.close()

    if page_index > 0:
        return None

    with Image.open(io.BytesIO(file_bytes)) as image:
        return image.convert("RGB")


def extract_native_text_in_normalized_rect(
    file_bytes: bytes,
    filename: str,
    page_index: int,
    rect: dict,
) -> str | None:
    """
    Extrait le texte natif d'un PDF dans un rectangle normalisé (0–1).
    Retourne None si le fichier n'est pas un PDF textuel exploitable.
    """
    ext = _extension_from_name(filename)
    is_pdf = ext in PDF_EXTENSIONS or file_bytes[:4] == b"%PDF"
    if not is_pdf:
        return None

    fitz, np, Image = _ensure_image_deps()
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if page_index < 0 or page_index >= len(doc):
            return None
        page = doc[page_index]
        page_rect = page.rect
        x0 = page_rect.x0 + rect["x"] * page_rect.width
        y0 = page_rect.y0 + rect["y"] * page_rect.height
        x1 = x0 + rect["width"] * page_rect.width
        y1 = y0 + rect["height"] * page_rect.height
        clip = fitz.Rect(x0, y0, x1, y1)
        text = page.get_textbox(clip) or ""
        return text.strip() or None
    finally:
        doc.close()


def _dominant_row_text(lines: list[dict]) -> tuple[str, float]:
    """
    Ne garde qu'une seule rangée de texte dans un crop
    (évite de fusionner la zone du dessous ou du dessus).
    """
    if not lines:
        return "", 0.0
    if len(lines) == 1:
        return lines[0].get("text", "").strip(), float(lines[0].get("confidence", 0.0))

    sorted_lines = sorted(lines, key=lambda row: row.get("cy", 0.0))
    rows: list[list[dict]] = []
    current = [sorted_lines[0]]
    for line in sorted_lines[1:]:
        if abs(line.get("cy", 0.0) - current[-1].get("cy", 0.0)) < 0.18:
            current.append(line)
        else:
            rows.append(current)
            current = [line]
    rows.append(current)

    best_row = max(rows, key=lambda row: sum(len(item.get("text", "")) for item in row))
    best_row.sort(key=lambda row: row.get("cx", 0.0))
    texts = [item.get("text", "").strip() for item in best_row if item.get("text")]
    confidences = [float(item.get("confidence", 0.0)) for item in best_row if item.get("text")]
    full_text = " ".join(texts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return full_text, avg_conf


def _prepare_crop_for_ocr(crop):
    """Agrandit les petits crops pour améliorer la précision OCR."""
    fitz, np, Image = _ensure_image_deps()
    width, height = crop.size
    min_side = min(width, height)
    if min_side >= MIN_CROP_SIDE_PX:
        return crop
    scale = MIN_CROP_SIDE_PX / max(min_side, 1)
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return crop.resize(new_size, Image.Resampling.LANCZOS)


def extract_text_from_cropped_image(
    image,
    rect: dict,
    enhance: bool = True,
    margin: float = ZONE_CROP_MARGIN,
    champ=None,
) -> tuple[str, float]:
    """
    Découpe une zone sur une image PIL et exécute l'OCR.
    Retourne (texte, confiance_moyenne).
    """
    width, height = image.size
    crop_rect = _expand_rect(rect, margin) if margin > 0 else rect
    left = max(0, int(crop_rect["x"] * width))
    top = max(0, int(crop_rect["y"] * height))
    right = min(width, int((crop_rect["x"] + crop_rect["width"]) * width))
    bottom = min(height, int((crop_rect["y"] + crop_rect["height"]) * height))

    if right <= left or bottom <= top:
        return "", 0.0

    crop = image.crop((left, top, right, bottom))
    crop = _prepare_crop_for_ocr(crop)
    if enhance:
        crop = _enhance_crop_image(crop)
    crop_np = _pil_to_numpy(_resize_for_ocr(crop))
    lines = _ocr_lines_from_numpy(crop_np)
    if not lines:
        return "", 0.0

    if champ is not None:
        from gestion_documentaire.services.zone_text_refine import assemble_crop_text
        return assemble_crop_text(lines, champ)

    return _dominant_row_text(lines)
