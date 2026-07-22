import { getApiUrl, getHeaders, apiFetch } from "./api";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.detail ||
      data.error ||
      (typeof data === "object" && Object.values(data).flat?.()[0]) ||
      `Erreur serveur (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Une erreur est survenue.");
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
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/** Métadonnées des filtres (types, localités, périodes). */
export const getAnalyticsMeta = async () => {
  const url = `${getApiUrl()}/api/gestion-acces/analytics/meta/`;
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

/** Statistiques documentaires avec filtres. */
export const getAnalyticsDocuments = async (filters = {}) => {
  const url = `${getApiUrl()}/api/gestion-acces/analytics/documents/${buildQuery(filters)}`;
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

/** Exploration hiérarchique géographique (drill-down local, sans recharger tout le dashboard). */
export const getAnalyticsDocumentsGeo = async (filters = {}, geoParent = "") => {
  const params = { ...filters };
  if (geoParent) params.geo_parent = geoParent;
  const url = `${getApiUrl()}/api/gestion-acces/analytics/documents/geo/${buildQuery(params)}`;
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

/** Statistiques d'administration (sans journal d'activité). */
export const getAnalyticsAdministration = async (filters = {}) => {
  const url = `${getApiUrl()}/api/gestion-acces/analytics/administration/${buildQuery(filters)}`;
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};
