import { getApiUrl, getMultipartHeaders } from "./api";
import { logError } from "../utils/logger";
import { USER_ERRORS } from "../utils/userError";

/**
 * Envoie le fichier au backend pour extraction OCR avec suivi de progression.
 * @param {object} params
 * @param {File} params.fichier
 * @param {number} params.typeDocumentId
 * @param {Array} [params.zoneOverrides]
 * @param {import("react").MutableRefObject<(() => void) | null>} [params.abortRef] — reçoit la fonction d'annulation
 * @param {(percent: number) => void} [params.onProgress] — 0 à 100
 */
export const extractDocumentFields = ({
  fichier,
  typeDocumentId,
  zoneOverrides,
  ocrPages,
  onProgress,
  abortRef,
}) => {
  const url = `${getApiUrl()}/api/gestion-documentaire/documents/extract-fields/`;
  const formData = new FormData();
  formData.append("fichier", fichier);
  formData.append("type_document", String(typeDocumentId));
  if (zoneOverrides?.length) {
    formData.append("zone_overrides", JSON.stringify(zoneOverrides));
  }
  if (ocrPages?.length) {
    formData.append("ocr_pages", JSON.stringify(ocrPages));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let simulatedTimer = null;
    let displayProgress = 0;

    const finish = () => {
      if (simulatedTimer) {
        clearInterval(simulatedTimer);
        simulatedTimer = null;
      }
      if (abortRef) {
        abortRef.current = null;
      }
    };

    if (abortRef) {
      abortRef.current = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      };
    }

    const emitProgress = (value) => {
      displayProgress = Math.min(99, Math.max(displayProgress, Math.round(value)));
      onProgress?.(displayProgress);
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        emitProgress((event.loaded / event.total) * 28);
      }
    });

    xhr.upload.addEventListener("loadend", () => {
      emitProgress(28);
      let simulated = 28;
      simulatedTimer = setInterval(() => {
        // Phase rapide puis ralentissement : la majeure partie du temps est côté serveur (OCR).
        if (simulated < 85) {
          simulated += 4 + Math.random() * 6;
        } else if (simulated < 96) {
          simulated += 0.6 + Math.random() * 1.4;
        } else {
          simulated += 0.08 + Math.random() * 0.15;
        }
        simulated = Math.min(98, simulated);
        emitProgress(simulated);
      }, 450);
    });

    xhr.addEventListener("load", () => {
      finish();
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(data);
        return;
      }

      const message =
        data?.detail ||
        data?.non_field_errors?.[0] ||
        "Erreur lors de l'extraction OCR";
      const error = new Error(typeof message === "string" ? message : "Erreur OCR");
      error.ocrUnavailable = xhr.status === 503;
      reject(error);
    });

    xhr.addEventListener("error", () => {
      finish();
      logError("ocr.extract", `Serveur API injoignable (${getApiUrl()}).`, { url });
      reject(new Error(USER_ERRORS.network));
    });

    xhr.addEventListener("abort", () => {
      finish();
      const error = new Error("Extraction annulée.");
      error.cancelled = true;
      reject(error);
    });

    xhr.open("POST", url);
    const headers = getMultipartHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.send(formData);
  });
};
