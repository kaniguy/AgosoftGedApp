import { getApiUrl, getHeaders, apiFetch } from "./api";

function parseFilename(contentDisposition, contentType) {
  if (contentDisposition) {
    const utfMatch = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      try {
        return decodeURIComponent(utfMatch[1].trim().replace(/^"|"$/g, ""));
      } catch {
        /* ignore */
      }
    }
    const match = /filename=(?:"([^"]+)"|([^;]+))/i.exec(contentDisposition);
    const raw = (match?.[1] || match?.[2] || "").trim();
    if (raw) {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  const type = String(contentType || "").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  if (type.includes("rar")) return `documents-${stamp}.rar`;
  if (type.includes("zip")) return `documents-${stamp}.zip`;
  return `documents-${stamp}.rar`;
}

/** Infos publiques d'un lien (sans connexion). */
export async function getPublicLienInfo(token) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/telechargement/${token}/info/`,
    { headers: { Accept: "application/json" } }
  );
  const data = await res.json().catch(() => ({}));
  return { data, httpStatus: res.status };
}

/** Télécharge via le lien public (sans connexion). */
export async function downloadPublicLienFichier(token, password = "") {
  const headers = {};
  const pwd = String(password || "").trim();
  const init = pwd
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password: pwd }),
      }
    : { method: "GET" };

  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/telechargement/${token}/fichier/`,
    init
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.message || "Téléchargement impossible.");
  }
  const blob = await res.blob();
  const filename = parseFilename(
    res.headers.get("Content-Disposition"),
    res.headers.get("Content-Type") || blob.type
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function getPublicLienPageUrl(token) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/telechargement/${token}`;
  }
  return `/telechargement/${token}`;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.detail ||
      (typeof data === "object" && Object.values(data).flat?.()[0]) ||
      "Une erreur est survenue.";
    throw new Error(typeof message === "string" ? message : String(message));
  }
  return data;
}

export const VALIDITY_HOUR_OPTIONS = [
  { value: 3, label: "3 heures" },
  { value: 5, label: "5 heures" },
  { value: 12, label: "12 heures" },
  { value: 24, label: "24 heures" },
];

/** Crée un lien de téléchargement temporaire pour un ou plusieurs documents. */
export const createLienTelechargement = async ({
  documentIds,
  validityHours,
  recipientEmail,
  oneTime = true,
  password = "",
}) => {
  const body = {
    document_ids: documentIds,
    validity_hours: validityHours,
    one_time: Boolean(oneTime),
  };
  const email = String(recipientEmail || "").trim();
  if (email) body.recipient_email = email;
  const pwd = String(password || "").trim();
  if (pwd) body.password = pwd;

  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/liens-telechargement/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/** Envoie un lien existant par e-mail. */
export const sendLienTelechargementEmail = async (linkId, recipientEmail) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/liens-telechargement/${linkId}/envoyer-email/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ recipient_email: String(recipientEmail || "").trim() }),
    }
  );
  return handleResponse(res);
};

/** Liste tous les liens (gestion des accès). */
export const getLiensTelechargement = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/liens-telechargement/`, {
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  return data.results || [];
};

/** Supprime définitivement un lien. */
export const deleteLienTelechargement = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/liens-telechargement/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Suppression impossible.");
  }
};

/** Active ou désactive un lien. */
export const toggleLienTelechargement = async (id, isActive) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/liens-telechargement/${id}/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ is_active: isActive }),
  });
  return handleResponse(res);
};
