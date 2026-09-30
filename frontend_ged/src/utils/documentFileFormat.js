/** Déduit le format affiché (PDF, JPEG, …) depuis l'URL ou le nom de fichier du document. */
export function getFileFormat(doc) {
  const source = (doc?.fichier_url || doc?.fichier || doc?.name || "").toLowerCase();
  const nameMatch = source.match(/[?&]name=([^&]+)/);
  let candidate = source.split("?")[0];
  if (nameMatch?.[1]) {
    try {
      candidate = decodeURIComponent(nameMatch[1]);
    } catch {
      candidate = nameMatch[1];
    }
  }
  const ext = candidate.split(".").pop() || "";
  const labels = {
    pdf: "PDF",
    jpg: "JPEG",
    jpeg: "JPEG",
    png: "PNG",
    webp: "WEBP",
    gif: "GIF",
    tif: "TIFF",
    tiff: "TIFF",
  };
  return labels[ext] || (ext && ext !== "fichier" ? ext.toUpperCase() : "—");
}

export function getFileFormatFromName(name) {
  return getFileFormat({ name });
}
