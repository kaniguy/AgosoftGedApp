/**
 * Configuration partagée du worker PDF.js (react-pdf).
 * À importer une fois avant tout usage de react-pdf côté client.
 * Worker servi depuis /public (évite unpkg / CDN injoignable sur le LAN).
 */
import { pdfjs } from "react-pdf";

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export { pdfjs };
