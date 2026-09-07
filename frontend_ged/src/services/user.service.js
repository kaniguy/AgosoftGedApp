import { getApiUrl, getHeaders, apiFetch } from "./api";

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

export const getUsers = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/users/`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const createUser = async (data) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/users/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const updateUser = async (id, data) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/users/${id}/`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const patchUser = async (id, data) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/users/${id}/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const deleteUser = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/users/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Erreur lors de la suppression.");
  }
  return { success: true };
};
