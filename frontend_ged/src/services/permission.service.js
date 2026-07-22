import { getApiUrl, getHeaders, apiFetch } from "./api";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Une erreur est survenue.");
  }
  return data;
}

export const getPermissions = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/permissions/`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};
