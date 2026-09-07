import { getApiUrl, getHeaders, apiFetch } from "./api";

// LISTE
export const getTypeDocuments = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/parametrage/type-documents/`, {
    headers: getHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
};

// CREATE
export const createTypeDocument = async (data) => {
  const res = await apiFetch(`${getApiUrl()}/api/parametrage/type-documents/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

// UPDATE
export const updateTypeDocument = async (id, data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${id}/`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  return res.json();
};

// DELETE
export const deleteTypeDocument = async (id) => {
  await apiFetch(`${getApiUrl()}/api/parametrage/type-documents/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return { success: true };
};

// ONE
export const getTypeDocument = async (id) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${id}/`,
    {
      headers: getHeaders(),
    }
  );
  return res.json();
};