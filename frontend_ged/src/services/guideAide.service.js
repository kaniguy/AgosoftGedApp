import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";

function extractError(data) {
  if (!data || typeof data !== "object") return "Une erreur est survenue.";
  if (data.detail) return String(data.detail);
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === "string") return first;
  return "Une erreur est survenue.";
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractError(data));
  }
  return data;
}

function normalizeGuide(item) {
  if (!item) return item;
  return {
    ...item,
    documents: (item.documents || []).map((doc) => ({
      ...doc,
      url: resolveMediaUrl(doc.url),
    })),
  };
}

export async function listGuidesAide() {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/guides-aide/`, {
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  const results = (data.results || []).map(normalizeGuide);
  return { results, modules: data.modules || [] };
}

export async function getGuideAide(id) {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/guides-aide/${id}/`, {
    headers: getHeaders(),
  });
  return normalizeGuide(await handleResponse(res));
}

export async function saveGuideAide(payload, id = null) {
  const formData = new FormData();
  formData.append("module_code", payload.module_code);
  formData.append("titre", payload.titre || "");
  formData.append("description", payload.description || "");
  formData.append("guide", payload.guide || "");
  formData.append("ordre", String(payload.ordre ?? 0));
  formData.append("actif", payload.actif ? "true" : "false");
  formData.append("youtube_url", payload.youtube_url || "");
  formData.append("delete_document_ids", (payload.delete_document_ids || []).join(","));
  for (const file of payload.documents_files || []) {
    if (file instanceof File) {
      formData.append("documents_files", file);
    }
  }

  const url = id
    ? `${getApiUrl()}/api/gestion-acces/guides-aide/${id}/`
    : `${getApiUrl()}/api/gestion-acces/guides-aide/`;
  const res = await apiFetch(url, {
    method: id ? "PATCH" : "POST",
    headers: getMultipartHeaders(),
    body: formData,
  });
  return normalizeGuide(await handleResponse(res));
}

export async function deleteGuideAide(id) {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/guides-aide/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractError(data));
  }
}
