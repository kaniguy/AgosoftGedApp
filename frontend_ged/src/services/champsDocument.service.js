import { getApiUrl, getHeaders, apiFetch } from "./api";

function extractApiError(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const firstFieldError = Object.values(data).find(
    (value) => Array.isArray(value) && value.length > 0
  )?.[0];

  const message =
    data.detail ||
    data.non_field_errors?.[0] ||
    firstFieldError ||
    fallback;

  return typeof message === "string" ? message : fallback;
}

async function parseApiResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractApiError(data, fallbackMessage));
  }
  return data;
}

// LISTE par type document
export const getChampsDocuments = async (typeDocumentId) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/champs-documents/?type_document=${typeDocumentId}`,
    { headers: getHeaders() }
  );

  return parseApiResponse(res, "Erreur lors du chargement des champs");
};

// CREATE
export const createChampsDocument = async (data) => {
  const res = await apiFetch(`${getApiUrl()}/api/parametrage/champs-documents/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  return parseApiResponse(res, "Erreur lors de l'ajout du champ");
};

// UPDATE
export const updateChampsDocument = async (id, data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/champs-documents/${id}/`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );

  return parseApiResponse(res, "Erreur lors de la mise à jour du champ");
};

// DELETE
export const deleteChampsDocument = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/parametrage/champs-documents/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractApiError(data, "Erreur lors de la suppression du champ"));
  }

  return { success: true };
};
