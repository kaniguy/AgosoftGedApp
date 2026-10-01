import { apiFetch, getApiUrl, getHeaders } from "./api";

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const plain = header.match(/filename="?([^"]+)"?/i);
  return plain?.[1] || fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeConfirm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function confirmsAction(typed, expected) {
  return Boolean(expected) && normalizeConfirm(typed) === normalizeConfirm(expected);
}

export async function getSauvegardeStatus() {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/sauvegarde/`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Impossible de charger l'état de la base.");
  }
  return data;
}

async function parseJobResponse(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || fallback);
  }
  if (!data.job_id || !data.token) {
    throw new Error(fallback);
  }
  return data;
}

export async function startExportSauvegarde() {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/sauvegarde/export/`, {
    method: "POST",
    headers: getHeaders(),
    body: "{}",
  });
  return parseJobResponse(res, "Export impossible.");
}

export async function startRestoreSauvegarde(file, confirmation, onUploadProgress) {
  const confirmValue = normalizeConfirm(confirmation);
  const body = new FormData();
  body.append("confirmation", confirmValue);
  body.append("fichier", file);
  const url = `${getApiUrl()}/api/gestion-acces/sauvegarde/restaurer/?confirmation=${encodeURIComponent(confirmValue)}`;

  if (typeof XMLHttpRequest === "undefined" || !onUploadProgress) {
    const res = await apiFetch(url, {
      method: "POST",
      headers: { "X-Sauvegarde-Confirmation": confirmValue },
      body,
      suppressAuthRedirect: true,
    });
    return parseJobResponse(res, "Restauration impossible.");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Sauvegarde-Confirmation", confirmValue);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const ratio = event.total ? event.loaded / event.total : 0;
      onUploadProgress({
        stage: "upload",
        percent: Math.max(1, Math.round(ratio * 12)),
        message: `Envoi de l'archive… ${Math.round(ratio * 100)} %`,
        status: "running",
      });
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.job_id && data.token) {
        resolve(data);
        return;
      }
      reject(new Error(data.detail || "Restauration impossible."));
    };
    xhr.onerror = () => reject(new Error("Restauration impossible."));
    xhr.send(body);
  });
}

export async function startResetSauvegarde(confirmation) {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/sauvegarde/reinitialiser/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ confirmation: normalizeConfirm(confirmation) }),
    suppressAuthRedirect: true,
  });
  return parseJobResponse(res, "Réinitialisation impossible.");
}

export async function getSauvegardeJob(jobId, token) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/sauvegarde/taches/${jobId}/?token=${encodeURIComponent(token)}`,
    { suppressAuthRedirect: true },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Suivi de l'opération impossible.");
  }
  return data;
}

export async function waitSauvegardeJob(jobId, token, onProgress) {
  let failures = 0;
  while (true) {
    try {
      const data = await getSauvegardeJob(jobId, token);
      failures = 0;
      onProgress?.(data);
      if (data.status === "done") return data;
      if (data.status === "error") {
        const error = new Error(data.error || data.message || "Opération impossible.");
        error.fatal = true;
        throw error;
      }
    } catch (err) {
      if (err?.fatal) throw err;
      failures += 1;
      if (failures >= 15) throw err;
    }
    await sleep(2000);
  }
}

export async function downloadSauvegardeJob(jobId, token, onProgress) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/sauvegarde/taches/${jobId}/fichier/?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Téléchargement impossible.");
  }

  const name = filenameFromDisposition(
    res.headers.get("content-disposition"),
    "ged-sauvegarde.zip",
  );
  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body?.getReader?.();
  let blob;

  if (reader) {
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (onProgress) {
        const pct = total ? 90 + Math.round((received / total) * 10) : 95;
        onProgress({
          stage: "ready",
          percent: Math.min(99, pct),
          message: total
            ? `Téléchargement ${Math.round((received / Math.max(total, 1)) * 100)} %…`
            : "Téléchargement de l'archive…",
          status: "running",
        });
      }
    }
    blob = new Blob(chunks, { type: "application/zip" });
  } else {
    blob = await res.blob();
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
