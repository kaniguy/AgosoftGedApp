import { getApiUrl, getHeaders, apiFetch } from "./api";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Une erreur est survenue.");
  }
  return data;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  });
  return query.toString();
}

/**
 * Liste paginée du journal d'activité.
 * @param {object} params - search, action, categorie, date_debut, date_fin, page, page_size
 */
export const getJournalActivite = async (params = {}) => {
  const qs = buildQuery(params);
  const url = `${getApiUrl()}/api/gestion-acces/journal-activite/${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

/**
 * Télécharge le journal filtré en fichier Excel.
 */
export const downloadJournalActiviteExcel = async (params = {}) => {
  const qs = buildQuery(params);
  const url = `${getApiUrl()}/api/gestion-acces/journal-activite/export-excel/${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { headers: getHeaders() });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Impossible d'exporter le journal.");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename =
    match?.[1] || `journal-activite-${new Date().toISOString().slice(0, 10)}.xlsx`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
