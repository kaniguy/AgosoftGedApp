"""Fusionne les annotations JSON dans un PDF ou une image (téléchargement / archive)."""
from __future__ import annotations

import base64
import io
import os
import re

import fitz
from PIL import Image

DEFAULT_STAMP_SIZE = {"width": 0.22, "height": 0.058}
DEFAULT_SIGNATURE_SIZE = {"width": 0.28, "height": 0.1}
STAMP_FONT = "hebo"
_DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,(.+)$", re.DOTALL)


def _decode_data_url_image(image_data: str) -> bytes | None:
    if not image_data:
        return None
    raw = str(image_data).strip()
    match = _DATA_URL_RE.match(raw)
    try:
        if match:
            return base64.b64decode(match.group(1))
        # fallback : base64 brut
        return base64.b64decode(raw)
    except Exception:
        return None


def _rotate_image_bytes(image_bytes: bytes, rotation_deg: float) -> bytes:
    """
    Applique une rotation libre (degrés CSS / sens horaire positif).
    PyMuPDF insert_image n'accepte que rotate ∈ {0,90,180,270}.
    """
    angle = float(rotation_deg or 0) % 360
    if abs(angle) < 0.01 or abs(angle - 360) < 0.01:
        return image_bytes
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        # CSS clockwise → PIL counter-clockwise
        rotated = image.rotate(-angle, expand=True, resample=Image.Resampling.BICUBIC)
        buf = io.BytesIO()
        rotated.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return image_bytes


def _insert_annotation_image(page, box: dict, pw: float, ph: float, image_bytes: bytes, rotation_deg: float) -> None:
    if not image_bytes:
        return
    prepared = _rotate_image_bytes(image_bytes, rotation_deg)
    rect = _page_rect(box, pw, ph)
    # rotate=0 : la rotation a déjà été appliquée dans l'image (Pillow)
    page.insert_image(rect, stream=prepared, keep_proportion=False, rotate=0)


def _hex_to_rgb(hex_color: str, default=(0.13, 0.13, 0.13)) -> tuple[float, float, float]:
    if not hex_color:
        return default
    h = str(hex_color).strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return default
    try:
        return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return default


def _annotation_box(ann: dict) -> dict:
    if ann.get("type") == "stamp":
        return {
            "x": float(ann.get("x") or 0),
            "y": float(ann.get("y") or 0),
            "width": float(ann.get("width") or DEFAULT_STAMP_SIZE["width"]),
            "height": float(ann.get("height") or DEFAULT_STAMP_SIZE["height"]),
        }
    if ann.get("type") == "signature":
        return {
            "x": float(ann.get("x") or 0),
            "y": float(ann.get("y") or 0),
            "width": float(ann.get("width") or DEFAULT_SIGNATURE_SIZE["width"]),
            "height": float(ann.get("height") or DEFAULT_SIGNATURE_SIZE["height"]),
        }
    if ann.get("type") in ("rect", "highlight"):
        return {
            "x": float(ann.get("x") or 0),
            "y": float(ann.get("y") or 0),
            "width": float(ann.get("width") or 0.1),
            "height": float(ann.get("height") or 0.05),
        }
    if ann.get("type") == "text":
        return {
            "x": float(ann.get("x") or 0),
            "y": float(ann.get("y") or 0),
            "width": float(ann.get("width") or 0.18),
            "height": float(ann.get("height") or 0.04),
        }
    return {"x": 0, "y": 0, "width": 0, "height": 0}


def _page_rect(box: dict, pw: float, ph: float) -> fitz.Rect:
    x, y, w, h = box["x"], box["y"], box["width"], box["height"]
    return fitz.Rect(x * pw, y * ph, (x + w) * pw, (y + h) * ph)


def _css_to_mupdf_rotation(rotation_deg: float) -> float:
    """
    Convertit l'angle stocké (CSS : positif = sens horaire)
    vers PyMuPDF Matrix (positif = sens antihoraire).
    """
    return -float(rotation_deg or 0)


def _rotation_morph(box: dict, pw: float, ph: float, rotation_deg: float):
    pdf_angle = _css_to_mupdf_rotation(rotation_deg)
    if not pdf_angle:
        return None
    cx = (box["x"] + box["width"] / 2) * pw
    cy = (box["y"] + box["height"] / 2) * ph
    return fitz.Point(cx, cy), fitz.Matrix(pdf_angle)


def _draw_rotated_rect(
    page,
    box,
    pw,
    ph,
    rotation_deg,
    *,
    fill=None,
    color=None,
    width=0,
    fill_opacity=1,
):
    rect = _page_rect(box, pw, ph)
    morph = _rotation_morph(box, pw, ph, rotation_deg)
    page.draw_rect(
        rect,
        color=color,
        fill=fill,
        width=width,
        fill_opacity=fill_opacity,
        stroke_opacity=1,
        morph=morph,
    )


def _box_center(box: dict, pw: float, ph: float) -> tuple[float, float]:
    cx = (box["x"] + box["width"] / 2) * pw
    cy = (box["y"] + box["height"] / 2) * ph
    return cx, cy


def _draw_centered_stamp_text(
    page,
    box: dict,
    pw: float,
    ph: float,
    text: str,
    color,
    rotation_deg: float,
    fontsize: float,
) -> None:
    """Texte centré dans le cadre, rotation autour du même centre que le rectangle."""
    cx, cy = _box_center(box, pw, ph)
    tw = fitz.get_text_length(text, fontname=STAMP_FONT, fontsize=fontsize)
    # Baseline légèrement sous le centre optique (majuscules).
    ox = cx - tw / 2
    oy = cy + fontsize * 0.32
    point = fitz.Point(ox, oy)
    kwargs = dict(fontsize=fontsize, fontname=STAMP_FONT, color=color)
    pdf_angle = _css_to_mupdf_rotation(rotation_deg)
    if pdf_angle:
        kwargs["morph"] = (fitz.Point(cx, cy), fitz.Matrix(pdf_angle))
    page.insert_text(point, text, **kwargs)


def _apply_annotation(page, ann: dict) -> None:
    pw, ph = page.rect.width, page.rect.height
    color = _hex_to_rgb(ann.get("color", "#212121"))
    ann_type = ann.get("type")
    rotation = float(ann.get("rotation") or 0)

    # Les anciens post-it (type "note") ne sont plus fusionnés dans le PDF.
    if ann_type == "note":
        return

    if ann_type == "highlight":
        box = _annotation_box(ann)
        _draw_rotated_rect(
            page,
            box,
            pw,
            ph,
            rotation,
            fill=color,
            color=color,
            width=0,
            fill_opacity=0.35,
        )
        return

    if ann_type == "rect":
        box = _annotation_box(ann)
        _draw_rotated_rect(page, box, pw, ph, rotation, color=color, width=2)
        return

    if ann_type == "stamp":
        image_bytes = _decode_data_url_image(ann.get("imageData") or "")
        if image_bytes:
            try:
                box = _annotation_box(ann)
                _insert_annotation_image(page, box, pw, ph, image_bytes, rotation)
            except Exception:
                pass
            return
        box = _annotation_box(ann)
        _draw_rotated_rect(page, box, pw, ph, rotation, color=color, width=2)
        text = str(ann.get("text") or "")
        h = box["height"] * ph
        fontsize = min(13, h * 0.42)
        _draw_centered_stamp_text(page, box, pw, ph, text, color, rotation, fontsize)
        return

    if ann_type == "text":
        box = _annotation_box(ann)
        text = str(ann.get("text") or "")
        morph = _rotation_morph(box, pw, ph, rotation)
        rect = _page_rect(box, pw, ph)
        page.insert_textbox(
            rect,
            text,
            fontsize=11,
            fontname="helv",
            color=color,
            align=fitz.TEXT_ALIGN_LEFT,
            morph=morph,
        )
        return

    if ann_type == "pen":
        points = ann.get("points") or []
        if len(points) < 2:
            return
        stroke = float(ann.get("strokeWidth") or 2)
        for i in range(1, len(points)):
            x0, y0 = points[i - 1]
            x1, y1 = points[i]
            page.draw_line(
                fitz.Point(float(x0) * pw, float(y0) * ph),
                fitz.Point(float(x1) * pw, float(y1) * ph),
                color=color,
                width=stroke,
            )
        return

    if ann_type == "signature":
        image_bytes = _decode_data_url_image(ann.get("imageData") or "")
        if not image_bytes:
            return
        try:
            box = _annotation_box(ann)
            _insert_annotation_image(page, box, pw, ph, image_bytes, rotation)
        except Exception:
            return
        return


def prepare_pdf_for_download(pdf_bytes: bytes, annotations=None) -> bytes:
    """
    Prépare un PDF pour téléchargement.
    Fusionne les annotations si présentes, sans modifier la géométrie du document.
    """
    if not pdf_bytes:
        return pdf_bytes
    anns = [a for a in (annotations or []) if isinstance(a, dict)]
    if not anns:
        return pdf_bytes
    return flatten_annotations_on_pdf(pdf_bytes, anns)


def flatten_annotations_on_pdf(pdf_bytes: bytes, annotations) -> bytes:
    """Retourne un PDF avec les annotations dessinées dedans (page intacte)."""
    if not pdf_bytes:
        return pdf_bytes
    if not annotations:
        return pdf_bytes

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            page_idx = int(ann.get("page") or 0)
            if page_idx < 0 or page_idx >= doc.page_count:
                continue
            _apply_annotation(doc[page_idx], ann)
        return doc.tobytes(garbage=0, clean=False)
    finally:
        doc.close()


def _extension_from_filename(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def _detect_image_filetype(content: bytes, filename: str = "") -> str | None:
    ext = _extension_from_filename(filename)
    ext_map = {
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".png": "png",
        ".webp": "webp",
        ".gif": "gif",
    }
    if ext in ext_map:
        return ext_map[ext]

    head = content[:12]
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:2] == b"\xff\xd8":
        return "jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return None


def _pixmap_to_image_bytes(pix: fitz.Pixmap, filetype: str) -> bytes:
    if filetype == "jpeg":
        return pix.tobytes("jpeg", jpg_quality=92)
    if filetype == "png":
        return pix.tobytes("png")
    if filetype in ("webp", "gif"):
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        buf = io.BytesIO()
        image.save(buf, format=filetype.upper())
        return buf.getvalue()
    return pix.tobytes("png")


def flatten_annotations_on_image(image_bytes: bytes, annotations, *, filetype: str) -> bytes:
    """
    Retourne une image avec les annotations dessinées dedans.

    PyMuPDF ne permet pas de dessiner (draw_line, draw_rect…) sur une page image
    ouverte directement — on intègre l'image dans un PDF mono-page temporaire.
    """
    if not image_bytes:
        return image_bytes
    if not annotations:
        return image_bytes

    src_doc = fitz.open(stream=image_bytes, filetype=filetype)
    try:
        if src_doc.page_count < 1:
            return image_bytes
        rect = src_doc[0].rect
    finally:
        src_doc.close()

    pdf_doc = fitz.open()
    try:
        page = pdf_doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(rect, stream=image_bytes)
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            page_idx = int(ann.get("page") or 0)
            if page_idx != 0:
                continue
            _apply_annotation(page, ann)
        pix = page.get_pixmap(alpha=False)
        return _pixmap_to_image_bytes(pix, filetype)
    finally:
        pdf_doc.close()


def prepare_image_for_download(image_bytes: bytes, annotations=None, *, filename: str = "") -> bytes:
    """Prépare une image pour téléchargement en fusionnant les annotations."""
    if not image_bytes:
        return image_bytes
    anns = [a for a in (annotations or []) if isinstance(a, dict)]
    if not anns:
        return image_bytes
    filetype = _detect_image_filetype(image_bytes, filename)
    if not filetype:
        return image_bytes
    return flatten_annotations_on_image(image_bytes, anns, filetype=filetype)


def prepare_file_for_download(content: bytes, annotations=None, *, filename: str = "") -> bytes:
    """Fusionne les annotations sur un PDF ou une image selon le contenu."""
    if not content:
        return content
    anns = [a for a in (annotations or []) if isinstance(a, dict)]
    if not anns:
        return content
    if content[:4] == b"%PDF":
        return prepare_pdf_for_download(content, anns)
    if _detect_image_filetype(content, filename):
        return prepare_image_for_download(content, anns, filename=filename)
    return content
