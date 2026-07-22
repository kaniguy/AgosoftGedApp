import { getApiUrl, getHeaders, apiFetch } from "./api";

export const PLAN_GEO_PAGE_SIZE = 15;

/** Ajoute les paramètres de consultation GED (accès + documents validés uniquement). */
function appendAccessFilter(url, filterAccess = false) {
  if (!filterAccess) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}filtrer_acces=1&documents_valides=1`;
}

async function handleResponse(res) {
  if (!res.ok) {
    let message = "Une erreur est survenue";
    try {
      const data = await res.json();
      message = data.detail || data.libelle?.[0] || JSON.stringify(data);
    } catch {
      message = res.statusText || message;
    }
    throw new Error(message);
  }
  if (res.status === 204) return { success: true };
  return res.json();
}

export const getPlanGeographique = async (id) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/${id}/`,
    { headers: getHeaders() }
  );
  return handleResponse(res);
};

export const getPlansGeographiques = async (
  offset = 0,
  limit = PLAN_GEO_PAGE_SIZE,
  filterAccess = false
) => {
  const url = appendAccessFilter(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/?offset=${offset}&limit=${limit}`,
    filterAccess
  );
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

export const getPlanGeographiqueCompteur = async (filterAccess = false) => {
  const url = appendAccessFilter(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/compteur/`,
    filterAccess
  );
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

export const rechercherPlansGeographiques = async (query, filterAccess = false) => {
  const url = appendAccessFilter(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/rechercher/?q=${encodeURIComponent(query)}`,
    filterAccess
  );
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

export const getPlanRechercheById = async (id, filterAccess = false) => {
  const url = appendAccessFilter(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/rechercher/?id=${id}`,
    filterAccess
  );
  const res = await apiFetch(url, { headers: getHeaders() });
  const data = await handleResponse(res);
  const results = Array.isArray(data?.results) ? data.results : [];
  return results[0] ?? null;
};

export const getPlanEnfants = async (
  parentId,
  offset = 0,
  limit = PLAN_GEO_PAGE_SIZE,
  filterAccess = false
) => {
  const url = appendAccessFilter(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/${parentId}/enfants/?offset=${offset}&limit=${limit}`,
    filterAccess
  );
  const res = await apiFetch(url, { headers: getHeaders() });
  return handleResponse(res);
};

export const createPlanGeographique = async (data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  return handleResponse(res);
};

export const addChildPlanGeographique = async (parentId, data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/${parentId}/add_child/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  return handleResponse(res);
};

export const updatePlanGeographique = async (id, data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/${id}/`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  return handleResponse(res);
};

export const deletePlanGeographique = async (id) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/plans-geographiques/plans-geographiques/${id}/`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );
  return handleResponse(res);
};
