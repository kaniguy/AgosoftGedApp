import { getApiUrl, getHeaders, apiFetch } from "./api";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError =
      data.detail ||
      data.email_host?.[0] ||
      data.email_port?.[0] ||
      data.email_host_user?.[0] ||
      data.email_use_ssl?.[0] ||
      data.non_field_errors?.[0];
    throw new Error(firstError || "Une erreur est survenue.");
  }
  return data;
}

export const getConfigurationEmail = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/configuration-email/`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const updateConfigurationEmail = async (payload) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/configuration-email/update/`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};
