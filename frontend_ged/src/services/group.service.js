import { getApiUrl, getHeaders, apiFetch } from "./api";
import { appendDocumentFilterParams } from "./documentLocalite.service";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.detail ||
      Object.entries(data)
        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
        .join(" | ") ||
      "Une erreur est survenue.";
    throw new Error(message);
  }
  return data;
}

export const getGroups = async ({ lite = false } = {}) => {
  const qs = lite ? "?lite=1" : "";
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/groups/${qs}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const createGroup = async (data) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/groups/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const updateGroup = async (id, data) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/groups/${id}/`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const patchGroup = async (id, data) => {
  const activation =
    data && Object.keys(data).length === 1 && Object.prototype.hasOwnProperty.call(data, "is_active");
  const url = activation
    ? `${getApiUrl()}/api/gestion-acces/groups/${id}/activation/`
    : `${getApiUrl()}/api/gestion-acces/groups/${id}/`;
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const deleteGroup = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/groups/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Erreur lors de la suppression.");
  }
  return { success: true };
};

/** Liste des modules assignables à un groupe. */
export const getAppModules = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/modules/`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

/** Localités du dernier niveau (feuilles) pour attribution à un groupe. */
export const getLocalitesDernierNiveau = async (
  search = "",
  filterAccess = false,
  { statutQualite, avecDocuments, totauxSeulement, typeDocumentId, columnFilters } = {}
) => {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (filterAccess) params.set("filtrer_acces", "1");
  if (avecDocuments) params.set("avec_documents", "1");
  if (totauxSeulement) params.set("totaux_seulement", "1");
  appendDocumentFilterParams(params, { typeDocumentId, statutQualite, columnFilters });
  const qs = params.toString();
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/localites/dernier-niveau${qs ? `?${qs}` : ""}`,
    { headers: getHeaders() }
  );
  const data = await handleResponse(res);
  if (Array.isArray(data)) {
    return { results: data, totauxParStatut: {} };
  }
  return {
    results: Array.isArray(data?.results) ? data.results : [],
    totauxParStatut: data?.totaux_par_statut || {},
  };
};
