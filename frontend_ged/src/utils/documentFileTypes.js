/**
 * Formats de fichiers acceptés dans la GED (hors vidéos) et capacités d'aperçu.
 * Doit rester aligné avec GED_DOCUMENT_EXTENSIONS (backend_ged/config/file_validation.py).
 */

export const GED_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "tif",
  "tiff",
  "webp",
  "gif",
  "csv",
  "txt",
  "zip",
];

/** Images que le navigateur sait afficher (TIFF exclu). */
const PREVIEWABLE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
const PREVIEWABLE_IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export const GED_ACCEPT_ATTRIBUTE = GED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** Fichiers pouvant être fusionnés comme pages dans un PDF. */
export const PAGE_SOURCE_ACCEPT_ATTRIBUTE = [
  ".pdf",
  ...PREVIEWABLE_IMAGE_EXTENSIONS.map((ext) => `.${ext}`),
  "application/pdf",
].join(",");

export const GED_FORMATS_LABEL =
  "PDF, Word, Excel, PowerPoint, images (JPG, PNG, TIFF), CSV, TXT ou ZIP";

export const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  gif: "image/gif",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

/** Options du filtre « Format » (valeurs comprises par filter_format côté API). */
export const FORMAT_FILTER_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word (DOC, DOCX)" },
  { value: "excel", label: "Excel (XLS, XLSX)" },
  { value: "powerpoint", label: "PowerPoint (PPT, PPTX)" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: "TIFF" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
  { value: "csv", label: "CSV" },
  { value: "txt", label: "TXT" },
  { value: "zip", label: "ZIP" },
];

/** Nom de fichier depuis une URL API (`?name=…`) ou un chemin. */
export function filenameFromDocumentUrl(url, fallback = "document") {
  if (!url) return fallback;
  const source = String(url);
  const nameMatch = source.match(/[?&]name=([^&]+)/);
  if (nameMatch?.[1]) {
    try {
      return decodeURIComponent(nameMatch[1]);
    } catch {
      return nameMatch[1];
    }
  }
  const last = source.split("/").pop()?.split("?")[0];
  return last || fallback;
}

/** Nom affiché / téléchargé d'un document : vrai nom (`?name=`), sinon « Type.ext ». */
export function getDocumentDisplayFilename(doc) {
  const url = doc?.fichier_url || doc?.fichier || "";
  const fromUrl = filenameFromDocumentUrl(url, "");
  if (fromUrl && fromUrl !== "fichier" && getFileExtension(fromUrl)) return fromUrl;
  const base = doc?.type_document_libelle || "document";
  const ext = getFileExtension(fromUrl);
  return ext ? `${base}.${ext}` : base;
}

export function getFileExtension(name) {
  const base = String(name || "").split(/[?#]/)[0];
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function mimeFromFilename(name) {
  return MIME_BY_EXTENSION[getFileExtension(name)] || "";
}

export function isPdfFile(file) {
  return file?.type === "application/pdf" || getFileExtension(file?.name) === "pdf";
}

export function isPreviewableImageMime(mime) {
  return PREVIEWABLE_IMAGE_MIMES.includes(String(mime || "").toLowerCase());
}

export function isPreviewableImageFile(file) {
  if (file?.type?.startsWith("image/")) return isPreviewableImageMime(file.type);
  return PREVIEWABLE_IMAGE_EXTENSIONS.includes(getFileExtension(file?.name));
}

/** PDF ou image affichable : aperçu, pages, annotations et zones OCR disponibles. */
export function isPreviewableFile(file) {
  return Boolean(file) && (isPdfFile(file) || isPreviewableImageFile(file));
}

/**
 * Formats rendus localement dans le navigateur (sans service en ligne) :
 * Word (.docx), Excel (.xlsx, .xls), CSV et texte. DOC, PPT(X), TIFF et ZIP restent en téléchargement.
 */
const OFFICE_PREVIEW_BY_EXTENSION = { docx: "docx", xlsx: "xlsx", xls: "xlsx", csv: "csv", txt: "text" };
const OFFICE_PREVIEW_BY_MIME = {
  [MIME_BY_EXTENSION.docx]: "docx",
  [MIME_BY_EXTENSION.xlsx]: "xlsx",
  [MIME_BY_EXTENSION.xls]: "xlsx",
  "text/csv": "csv",
  "text/plain": "text",
};

export const OFFICE_PREVIEW_LABELS = {
  docx: "Aperçu Word",
  xlsx: "Aperçu Excel",
  csv: "Aperçu CSV",
  text: "Aperçu texte",
};

/** Windows type souvent les .csv en `application/vnd.ms-excel` : l'extension prime sur le MIME. */
export function getOfficePreviewFormat({ name, mime } = {}) {
  const ext = getFileExtension(name);
  if (ext) return OFFICE_PREVIEW_BY_EXTENSION[ext] || null;
  const baseMime = String(mime || "").split(";")[0].trim().toLowerCase();
  return OFFICE_PREVIEW_BY_MIME[baseMime] || null;
}

export function isAcceptedGedFile(file) {
  if (!file) return false;
  return GED_FILE_EXTENSIONS.includes(getFileExtension(file.name));
}
