import { getApiUrl, getHeaders, apiFetch } from "./api";

function normalizeComment(item) {
  if (!item) return item;
  return {
    id: item.id,
    document: item.document,
    texte: item.texte || "",
    auteur: item.auteur ?? null,
    auteur_nom: item.auteur_nom || "Utilisateur",
    is_mine: Boolean(item.is_mine),
    date_creation: item.date_creation || null,
    date_modification: item.date_modification || null,
  };
}

export async function listDocumentComments(documentId) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${documentId}/commentaires/`,
    { headers: getHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Impossible de charger les commentaires");
  }
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map(normalizeComment);
}

export async function createDocumentComment(documentId, texte) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${documentId}/commentaires/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ texte }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.texte?.[0] || data.detail || "Impossible d'ajouter le commentaire"
    );
  }
  return normalizeComment(data);
}

export async function updateDocumentComment(documentId, commentId, texte) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${documentId}/commentaires/${commentId}/`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ texte }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.texte?.[0] || data.detail || "Impossible de modifier le commentaire"
    );
  }
  return normalizeComment(data);
}

export async function deleteDocumentComment(documentId, commentId) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${documentId}/commentaires/${commentId}/`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Impossible de supprimer le commentaire");
  }
}
