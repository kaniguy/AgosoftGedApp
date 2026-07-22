/**
 * Manipulation de pages PDF (ajout, suppression, séparation) via pdf-lib.
 */
import { PDFDocument } from "pdf-lib";
import { pdfjs } from "@/utils/configurePdfJs";

function isPdfFile(file) {
  return file?.type === "application/pdf" || (file?.name || "").toLowerCase().endsWith(".pdf");
}

function isImageFile(file) {
  return file?.type?.startsWith("image/");
}

/** Convertit un fichier (PDF ou image) en tableau d'octets PDF. */
export async function fileToPdfBytes(file) {
  if (!file) throw new Error("Fichier manquant");

  if (isPdfFile(file)) {
    return new Uint8Array(await file.arrayBuffer());
  }

  if (isImageFile(file)) {
    const pdfDoc = await PDFDocument.create();
    const bytes = await file.arrayBuffer();
    let image;
    if (file.type === "image/png") {
      image = await pdfDoc.embedPng(bytes);
    } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
      image = await pdfDoc.embedJpg(bytes);
    } else {
      const blob = new Blob([bytes], { type: file.type || "image/png" });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        image = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return pdfDoc.save();
  }

  throw new Error("Format non supporté pour la manipulation PDF");
}

/** Retourne un File PDF à partir d'octets. */
function bytesToPdfFile(bytes, baseName = "document") {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const name = baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName.replace(/\.[^.]+$/, "")}.pdf`;
  return new File([blob], name, { type: "application/pdf", lastModified: Date.now() });
}

/** Compte le nombre de pages d'un fichier. */
export async function getPdfPageCount(file) {
  const bytes = await fileToPdfBytes(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

/** Supprime une page (index 0-based) et retourne un nouveau File PDF. */
export async function removePageFromPdf(file, pageIndex) {
  const bytes = await fileToPdfBytes(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const count = doc.getPageCount();
  if (count <= 1) {
    throw new Error("Impossible de supprimer la seule page du document");
  }
  if (pageIndex < 0 || pageIndex >= count) {
    throw new Error("Page invalide");
  }
  doc.removePage(pageIndex);
  const saved = await doc.save({ useObjectStreams: false });
  return bytesToPdfFile(saved, file.name);
}

/**
 * Sépare le document à partir de pageIndex (0-based) :
 * conserve les pages avant pageIndex, supprime le reste.
 */
export async function splitPdfBeforePage(file, pageIndex) {
  const bytes = await fileToPdfBytes(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const count = doc.getPageCount();
  if (pageIndex <= 0 || pageIndex >= count) {
    throw new Error("Point de séparation invalide");
  }
  while (doc.getPageCount() > pageIndex) {
    doc.removePage(doc.getPageCount() - 1);
  }
  const saved = await doc.save({ useObjectStreams: false });
  return bytesToPdfFile(saved, file.name);
}

/** Dimensions d'une page PDF en points (72 pt = 1 pouce). */
function getPdfPageSizePoints(pdfDoc, pageIndex = 0) {
  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();
  return { width, height };
}

/** Calcule taille et position pour contenir une image dans une page (ratio conservé). */
function fitImageInPage(imageWidth, imageHeight, pageWidth, pageHeight) {
  const imgAspect = imageWidth / imageHeight;
  const pageAspect = pageWidth / pageHeight;

  if (imgAspect > pageAspect) {
    const drawWidth = pageWidth;
    const drawHeight = pageWidth / imgAspect;
    return {
      x: 0,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    };
  }

  const drawHeight = pageHeight;
  const drawWidth = pageHeight * imgAspect;
  return {
    x: (pageWidth - drawWidth) / 2,
    y: 0,
    width: drawWidth,
    height: drawHeight,
  };
}

/** Rend une page PDF en PNG + ses dimensions réelles en points. */
async function renderPdfPageToPngBytes(file, pageIndex, renderScale = 2) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale: renderScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rendu page impossible"))), "image/png");
  });
  const pngBytes = new Uint8Array(await blob.arrayBuffer());
  return {
    pngBytes,
    widthPts: baseViewport.width,
    heightPts: baseViewport.height,
  };
}

/** Ajoute une image rasterisée sur une page aux dimensions de référence. */
async function addImagePageAtSize(targetDoc, pngBytes, contentWidthPts, contentHeightPts, pageWidth, pageHeight) {
  const image = await targetDoc.embedPng(pngBytes);
  const page = targetDoc.addPage([pageWidth, pageHeight]);
  const fit = fitImageInPage(contentWidthPts, contentHeightPts, pageWidth, pageHeight);
  page.drawImage(image, fit);
}

/** Intègre des pages PDF rasterisées, calées sur la taille de référence du document. */
async function embedPdfPagesAsImages(targetDoc, sourceFile, pageIndices, pageWidth, pageHeight) {
  for (const pageIndex of pageIndices) {
    const { pngBytes, widthPts, heightPts } = await renderPdfPageToPngBytes(sourceFile, pageIndex);
    await addImagePageAtSize(targetDoc, pngBytes, widthPts, heightPts, pageWidth, pageHeight);
  }
}

/** Intègre une image (fichier) comme nouvelle page aux dimensions de référence. */
async function embedImageFileAsPage(targetDoc, imageFile, pageWidth, pageHeight) {
  const bytes = await imageFile.arrayBuffer();
  let image;
  if (imageFile.type === "image/png") {
    image = await targetDoc.embedPng(bytes);
  } else if (imageFile.type === "image/jpeg" || imageFile.type === "image/jpg") {
    image = await targetDoc.embedJpg(bytes);
  } else {
    const pngBytes = await fileToPdfBytes(imageFile);
    const tempDoc = await PDFDocument.load(pngBytes, { ignoreEncryption: true });
    const { width: contentW, height: contentH } = getPdfPageSizePoints(tempDoc, 0);
    const tempBytes = await tempDoc.save({ useObjectStreams: false });
    const rendered = await renderPdfPageToPngBytes(bytesToPdfFile(tempBytes, "page.pdf"), 0);
    await addImagePageAtSize(targetDoc, rendered.pngBytes, contentW, contentH, pageWidth, pageHeight);
    return;
  }

  const page = targetDoc.addPage([pageWidth, pageHeight]);
  const fit = fitImageInPage(image.width, image.height, pageWidth, pageHeight);
  page.drawImage(image, fit);
}

/** Ajoute des pages sélectionnées d'un fichier source au document de base. */
export async function appendSelectedPagesToPdf(baseFile, sourceFile, selectedPageIndices = null) {
  const baseBytes = await fileToPdfBytes(baseFile);
  const merged = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
  const { width: pageWidth, height: pageHeight } = getPdfPageSizePoints(merged, 0);

  if (isPdfFile(sourceFile)) {
    const extraBytes = await fileToPdfBytes(sourceFile);
    const extraDoc = await PDFDocument.load(extraBytes, { ignoreEncryption: true });
    const count = extraDoc.getPageCount();
    const indices =
      selectedPageIndices == null
        ? extraDoc.getPageIndices()
        : selectedPageIndices.filter((i) => i >= 0 && i < count);

    if (!indices.length) {
      throw new Error("Aucune page sélectionnée");
    }

    await embedPdfPagesAsImages(merged, sourceFile, indices, pageWidth, pageHeight);
  } else if (isImageFile(sourceFile)) {
    await embedImageFileAsPage(merged, sourceFile, pageWidth, pageHeight);
  } else {
    throw new Error("Format non supporté");
  }

  const saved = await merged.save({ useObjectStreams: false });
  return bytesToPdfFile(saved, baseFile.name);
}

/**
 * Interprète une sélection de pages (1-based) : "all", "3", "1,3,5", "2-4", "1-3,7".
 * Retourne des indices 0-based triés.
 */
export function parsePageSelection(spec, pageCount) {
  if (!pageCount || pageCount < 1) {
    throw new Error("PDF sans page");
  }
  if (!spec || spec === "all" || spec === "*") {
    return Array.from({ length: pageCount }, (_, i) => i);
  }

  const indices = new Set();
  const parts = String(spec)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [rawStart, rawEnd] = part.split("-");
      const start = parseInt(rawStart, 10);
      const end = parseInt(rawEnd, 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end > pageCount || start > end) {
        throw new Error(`Plage invalide : ${part} (1-${pageCount})`);
      }
      for (let i = start; i <= end; i += 1) indices.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (Number.isNaN(n) || n < 1 || n > pageCount) {
        throw new Error(`Page invalide : ${part} (1-${pageCount})`);
      }
      indices.add(n - 1);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

/** Ajoute les pages de fichiers supplémentaires à la fin du document de base (toutes les pages). */
export async function appendFilesToPdf(baseFile, additionalFiles) {
  let result = baseFile;
  for (const extra of additionalFiles) {
    result = await appendSelectedPagesToPdf(result, extra, null);
  }
  return result;
}

/** Normalise tout fichier accepté en PDF pour le contrôle qualité. */
export async function normalizeToPdfFile(file) {
  if (isPdfFile(file)) return file;
  const bytes = await fileToPdfBytes(file);
  return bytesToPdfFile(bytes, file.name);
}

/** Remplace une page du PDF par le contenu d'un PDF mono-page (octets). */
async function replacePageAtIndex(file, pageIndex, replacementPageBytes) {
  const sourceBytes = await fileToPdfBytes(file);
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const replacementDoc = await PDFDocument.load(replacementPageBytes, { ignoreEncryption: true });
  const output = await PDFDocument.create();

  for (let i = 0; i < sourceDoc.getPageCount(); i += 1) {
    if (i === pageIndex) {
      const [page] = await output.copyPages(replacementDoc, [0]);
      output.addPage(page);
    } else {
      const [page] = await output.copyPages(sourceDoc, [i]);
      output.addPage(page);
    }
  }

  const saved = await output.save({ useObjectStreams: false });
  return bytesToPdfFile(saved, file.name);
}

/**
 * Rogne / recadre une page du PDF.
 * @param cropRect — zone normalisée 0-1 : { x, y, width, height } depuis le coin supérieur gauche.
 */
export async function cropPdfPage(file, pageIndex, cropRect) {
  const { x, y, width, height } = cropRect;
  if (width < 0.02 || height < 0.02) {
    throw new Error("Zone de rognage trop petite");
  }

  const sourceBytes = await fileToPdfBytes(file);
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  if (pageIndex < 0 || pageIndex >= sourceDoc.getPageCount()) {
    throw new Error("Page invalide");
  }

  const { width: pageWidth, height: pageHeight } = getPdfPageSizePoints(sourceDoc, pageIndex);
  const { pngBytes } = await renderPdfPageToPngBytes(file, pageIndex, 2);

  const blob = new Blob([pngBytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  let img;
  try {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  const sx = Math.max(0, Math.round(x * img.width));
  const sy = Math.max(0, Math.round(y * img.height));
  const sw = Math.min(img.width - sx, Math.round(width * img.width));
  const sh = Math.min(img.height - sy, Math.round(height * img.height));

  if (sw < 4 || sh < 4) {
    throw new Error("Zone de rognage trop petite");
  }

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const croppedPng = new Uint8Array(
    await new Promise((resolve, reject) => {
      canvas.toBlob(async (b) => {
        if (!b) {
          reject(new Error("Rognage impossible"));
          return;
        }
        resolve(await b.arrayBuffer());
      }, "image/png");
    })
  );

  const pagePdf = await PDFDocument.create();
  const image = await pagePdf.embedPng(croppedPng);
  const page = pagePdf.addPage([pageWidth, pageHeight]);
  const fit = fitImageInPage(sw, sh, pageWidth, pageHeight);
  page.drawImage(image, fit);

  const croppedPageBytes = await pagePdf.save({ useObjectStreams: false });
  return replacePageAtIndex(file, pageIndex, croppedPageBytes);
}

async function loadImageFromBytes(bytes) {
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToPngBytes(canvas) {
  return new Uint8Array(
    await new Promise((resolve, reject) => {
      canvas.toBlob(async (b) => {
        if (!b) {
          reject(new Error("Conversion image impossible"));
          return;
        }
        resolve(await b.arrayBuffer());
      }, "image/png");
    })
  );
}

/**
 * Fait pivoter une page de 90° (direction : 'left' | 'right').
 */
export async function rotatePdfPage(file, pageIndex, direction) {
  const delta = direction === "right" ? 90 : -90;
  const sourceBytes = await fileToPdfBytes(file);
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  if (pageIndex < 0 || pageIndex >= sourceDoc.getPageCount()) {
    throw new Error("Page invalide");
  }

  const { width: pageWidth, height: pageHeight } = getPdfPageSizePoints(sourceDoc, pageIndex);
  const { pngBytes } = await renderPdfPageToPngBytes(file, pageIndex, 2);
  const img = await loadImageFromBytes(pngBytes);

  const swap = Math.abs(delta) === 90;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((delta * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  const rotatedPng = await canvasToPngBytes(canvas);
  const newPageW = swap ? pageHeight : pageWidth;
  const newPageH = swap ? pageWidth : pageHeight;

  const pagePdf = await PDFDocument.create();
  const image = await pagePdf.embedPng(rotatedPng);
  const page = pagePdf.addPage([newPageW, newPageH]);
  const fit = fitImageInPage(canvas.width, canvas.height, newPageW, newPageH);
  page.drawImage(image, fit);

  const pageBytes = await pagePdf.save({ useObjectStreams: false });
  return replacePageAtIndex(file, pageIndex, pageBytes);
}
