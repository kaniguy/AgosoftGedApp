import { PDFDocument, rgb, StandardFonts, degrees, LineCapStyle } from "pdf-lib";

export const ANNOTATION_TOOLS = {
  SELECT: "select",
  HIGHLIGHT: "highlight",
  RECT: "rect",
  TEXT: "text",
  PEN: "pen",
  STAMP: "stamp",
  SIGNATURE: "signature",
};

export const ANNOTATION_COLORS = {
  yellow: "#FFEB3B",
  green: "#4CAF50",
  red: "#F44336",
  blue: "#2196F3",
  black: "#212121",
};

export const STAMP_LABELS = {
  approuve: "APPROUVÉ",
  rejete: "REJETÉ",
  confidentiel: "CONFIDENTIEL",
  copie: "COPIE",
};

/** Couleurs par défaut des tampons prédéfinis */
export const STAMP_DEFAULT_COLORS = {
  approuve: "#2E7D32",
  rejete: "#C62828",
  confidentiel: "#E65100",
  copie: "#1565C0",
};

export const DEFAULT_STAMP_SIZE = { width: 0.22, height: 0.058 };
export const DEFAULT_SIGNATURE_SIZE = { width: 0.28, height: 0.1 };
const MIN_BOX_WIDTH = 0.03;
const MIN_BOX_HEIGHT = 0.02;

/** Limites de taille (coords normalisées) pour éviter déformation au téléchargement. */
export const STAMP_SIZE_LIMITS = {
  minWidth: 0.08,
  maxWidth: 0.42,
};
export const SIGNATURE_SIZE_LIMITS = {
  minWidth: 0.1,
  maxWidth: 0.5,
};

export function getImageAnnotationSizeLimits(type) {
  if (type === "stamp") return STAMP_SIZE_LIMITS;
  if (type === "signature") return SIGNATURE_SIZE_LIMITS;
  return null;
}

function hexToRgb(hex) {
  const h = (hex || "#FFEB3B").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function createAnnotationId() {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAnnotations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object" && a.type !== "note")
    .map((ann) => {
      if (ann.type === "stamp") {
        return {
          ...ann,
          width: ann.width ?? DEFAULT_STAMP_SIZE.width,
          height: ann.height ?? DEFAULT_STAMP_SIZE.height,
        };
      }
      if (ann.type === "signature") {
        return {
          ...ann,
          width: ann.width ?? DEFAULT_SIGNATURE_SIZE.width,
          height: ann.height ?? DEFAULT_SIGNATURE_SIZE.height,
        };
      }
      return ann;
    });
}

export function canTransformAnnotation(ann) {
  return (
    ann?.type === "stamp" ||
    ann?.type === "signature" ||
    ann?.type === "rect" ||
    ann?.type === "highlight" ||
    ann?.type === "text"
  );
}

export function canMoveAnnotation(ann) {
  return canTransformAnnotation(ann);
}

export function getAnnotationBox(ann) {
  if (ann.type === "stamp") {
    return {
      x: ann.x ?? 0,
      y: ann.y ?? 0,
      width: ann.width ?? DEFAULT_STAMP_SIZE.width,
      height: ann.height ?? DEFAULT_STAMP_SIZE.height,
    };
  }
  if (ann.type === "signature") {
    return {
      x: ann.x ?? 0,
      y: ann.y ?? 0,
      width: ann.width ?? DEFAULT_SIGNATURE_SIZE.width,
      height: ann.height ?? DEFAULT_SIGNATURE_SIZE.height,
    };
  }
  if (ann.type === "rect" || ann.type === "highlight") {
    return {
      x: ann.x ?? 0,
      y: ann.y ?? 0,
      width: ann.width ?? 0.1,
      height: ann.height ?? 0.05,
    };
  }
  if (ann.type === "text") {
    return {
      x: ann.x ?? 0,
      y: ann.y ?? 0,
      width: ann.width ?? 0.18,
      height: ann.height ?? 0.04,
    };
  }
  return null;
}

export function clampBox(box) {
  const width = Math.max(MIN_BOX_WIDTH, Math.min(1, box.width ?? MIN_BOX_WIDTH));
  const height = Math.max(MIN_BOX_HEIGHT, Math.min(1, box.height ?? MIN_BOX_HEIGHT));
  const x = Math.min(Math.max(0, box.x ?? 0), 1 - width);
  const y = Math.min(Math.max(0, box.y ?? 0), 1 - height);
  return { x, y, width, height };
}

export function applyMove(origBox, dx, dy) {
  const x = Math.min(Math.max(0, (origBox.x ?? 0) + dx), 1 - (origBox.width ?? MIN_BOX_WIDTH));
  const y = Math.min(Math.max(0, (origBox.y ?? 0) + dy), 1 - (origBox.height ?? MIN_BOX_HEIGHT));
  return { ...origBox, x, y };
}

export function applyResize(origBox, dx, dy) {
  const width = Math.max(MIN_BOX_WIDTH, Math.min(1 - origBox.x, origBox.width + dx));
  const height = Math.max(MIN_BOX_HEIGHT, Math.min(1 - origBox.y, origBox.height + dy));
  return { ...origBox, width, height };
}

export function applyResizeCorner(origBox, dx, dy, corner, rotationDeg = 0, options = {}) {
  const {
    lockAspectRatio = false,
    minWidth = MIN_BOX_WIDTH,
    maxWidth = 1,
  } = options;

  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ldx = dx * cos - dy * sin;
  const ldy = dx * sin + dy * cos;

  const aspect = Math.max(origBox.width, 1e-6) / Math.max(origBox.height, 1e-6);

  let width;
  let height;

  if (lockAspectRatio) {
    let proposedW;
    let proposedH;
    switch (corner) {
      case "nw":
        proposedW = origBox.width - ldx;
        proposedH = origBox.height - ldy;
        break;
      case "ne":
        proposedW = origBox.width + ldx;
        proposedH = origBox.height - ldy;
        break;
      case "sw":
        proposedW = origBox.width - ldx;
        proposedH = origBox.height + ldy;
        break;
      case "se":
      default:
        proposedW = origBox.width + ldx;
        proposedH = origBox.height + ldy;
        break;
    }

    const scaleW = proposedW / Math.max(origBox.width, 1e-6);
    const scaleH = proposedH / Math.max(origBox.height, 1e-6);
    const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;

    width = origBox.width * scale;
    height = width / aspect;
  } else {
    switch (corner) {
      case "nw":
        width = origBox.width - ldx;
        height = origBox.height - ldy;
        break;
      case "ne":
        width = origBox.width + ldx;
        height = origBox.height - ldy;
        break;
      case "sw":
        width = origBox.width - ldx;
        height = origBox.height + ldy;
        break;
      case "se":
      default:
        width = origBox.width + ldx;
        height = origBox.height + ldy;
        break;
    }
  }

  width = Math.max(minWidth, Math.min(maxWidth, width));
  if (lockAspectRatio) {
    height = width / aspect;
  } else {
    height = Math.max(MIN_BOX_HEIGHT, height);
  }

  let x = origBox.x;
  let y = origBox.y;
  switch (corner) {
    case "nw":
      x = origBox.x + origBox.width - width;
      y = origBox.y + origBox.height - height;
      break;
    case "ne":
      y = origBox.y + origBox.height - height;
      break;
    case "sw":
      x = origBox.x + origBox.width - width;
      break;
    case "se":
    default:
      break;
  }

  return clampBox({ x, y, width, height });
}

export function pointerAngleDeg(centerX, centerY, clientX, clientY) {
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
}

export function normalizeRotation(value) {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

function getRotatedPdfRect(box, pageW, pageH, rotationDeg = 0) {
  // CSS : positif = horaire ; PDF/pdf-lib : positif = antihoraire → on inverse.
  const pdfRotation = -rotationDeg;
  const w = box.width * pageW;
  const h = box.height * pageH;
  const cx = (box.x + box.width / 2) * pageW;
  const cy = pageH - (box.y + box.height / 2) * pageH;
  const rad = (pdfRotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = -w / 2;
  const localY = -h / 2;
  const x = cx + localX * cos - localY * sin;
  const y = cy + localX * sin + localY * cos;
  return { x, y, width: w, height: h, rotate: degrees(pdfRotation) };
}

/**
 * Applique les annotations sur un PDF (coordonnées normalisées 0–1, origine haut-gauche).
 */
export async function applyAnnotationsToPdf(file, annotations) {
  if (!file || !annotations?.length) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.page ?? 0];
    if (!page) continue;
    const { width, height } = page.getSize();
    const { r, g, b } = hexToRgb(ann.color);
    const color = rgb(r, g, b);

    if (ann.type === "highlight" || ann.type === "rect") {
      const box = getAnnotationBox(ann);
      const rotation = ann.rotation || 0;
      const { x, y, width: w, height: h, rotate } = getRotatedPdfRect(box, width, height, rotation);
      if (ann.type === "highlight") {
        page.drawRectangle({ x, y, width: w, height: h, color, opacity: 0.35, borderWidth: 0, rotate });
      } else {
        page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 2, rotate });
      }
    } else if (ann.type === "stamp") {
      const box = getAnnotationBox(ann);
      const rotation = ann.rotation || 0;
      if (ann.imageData) {
        try {
          const embedded = await embedAnnotationImage(pdfDoc, ann.imageData);
          if (embedded) {
            const { x, y, width: w, height: h, rotate } = getRotatedPdfRect(
              box,
              width,
              height,
              rotation
            );
            page.drawImage(embedded, { x, y, width: w, height: h, rotate });
          }
        } catch {
          // image illisible
        }
      } else {
        const w = box.width * width;
        const h = box.height * height;
        const cx = (box.x + box.width / 2) * width;
        const cy = height - (box.y + box.height / 2) * height;
        const { x, y, width: rw, height: rh, rotate } = getRotatedPdfRect(box, width, height, rotation);
        const fontSize = Math.min(13, h * 0.42);
        const text = String(ann.text || "");
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawRectangle({
          x,
          y,
          width: rw,
          height: rh,
          borderColor: color,
          borderWidth: 2,
          opacity: 0.95,
          rotate,
        });
        page.drawText(text, {
          x: cx - textWidth / 2,
          y: cy - fontSize * 0.35,
          size: fontSize,
          font,
          color,
          rotate: degrees(-rotation),
        });
      }
    } else if (ann.type === "text") {
      const box = getAnnotationBox(ann);
      const rotation = ann.rotation || 0;
      const { x, y, width: w, height: h, rotate } = getRotatedPdfRect(box, width, height, rotation);
      page.drawText(String(ann.text || ""), {
        x: x + 4,
        y: y + h - 14,
        size: 11,
        font,
        color,
        rotate,
        maxWidth: Math.max(8, w - 8),
        lineHeight: 14,
      });
    } else if (ann.type === "pen" && ann.points?.length > 1) {
      const thickness = ann.strokeWidth || 2;
      for (let i = 1; i < ann.points.length; i++) {
        const [x0, y0] = ann.points[i - 1];
        const [x1, y1] = ann.points[i];
        page.drawLine({
          start: { x: x0 * width, y: height - y0 * height },
          end: { x: x1 * width, y: height - y1 * height },
          thickness,
          color,
          lineCap: LineCapStyle.Round,
        });
      }
    } else if (ann.type === "signature" && ann.imageData) {
      const box = getAnnotationBox(ann);
      const rotation = ann.rotation || 0;
      try {
        const embedded = await embedAnnotationImage(pdfDoc, ann.imageData);
        if (embedded) {
          const { x, y, width: w, height: h, rotate } = getRotatedPdfRect(
            box,
            width,
            height,
            rotation
          );
          page.drawImage(embedded, { x, y, width: w, height: h, rotate });
        }
      } catch {
        // image illisible — ignorer
      }
    }
  }

  return pdfDoc.save();
}

async function embedAnnotationImage(pdfDoc, imageData) {
  if (!imageData || typeof imageData !== "string") return null;
  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  if (mime.includes("png")) return pdfDoc.embedPng(bytes);
  if (mime.includes("jpeg") || mime.includes("jpg")) return pdfDoc.embedJpg(bytes);
  // fallback : tenter PNG puis JPG
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return pdfDoc.embedJpg(bytes);
  }
}

export async function fileWithAnnotations(file, annotations) {
  if (!file || !annotations?.length) return file;
  const bytes = await applyAnnotationsToPdf(file, annotations);
  return new File([bytes], file.name || "document.pdf", {
    type: file.type || "application/pdf",
  });
}
