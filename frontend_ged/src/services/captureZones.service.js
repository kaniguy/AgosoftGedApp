/**
 * Service API — zones de capture et document modèle (paramétrage).
 * Style Dokmee Capture : encadrement des champs sur un document de référence.
 */

import { getApiUrl, getHeaders, getMultipartHeaders, apiFetch } from "./api";

/**
 * Récupère le type de document, ses champs et leurs zones de capture.
 */
export const getCaptureZones = async (typeDocumentId) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${typeDocumentId}/capture-zones/`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Erreur lors du chargement des zones de capture");
  }

  return res.json();
};

/**
 * Enregistre en masse les zones de capture pour un type de document.
 */
export const saveCaptureZones = async (typeDocumentId, zones) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${typeDocumentId}/capture-zones/`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ zones }),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Erreur lors de l'enregistrement des zones");
  }

  return res.json();
};

/**
 * Upload ou remplace le document modèle de capture (PDF ou image).
 */
export const uploadModeleCapture = async (typeDocumentId, fichier) => {
  const formData = new FormData();
  formData.append("fichier", fichier);

  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${typeDocumentId}/modele-capture/`,
    {
      method: "POST",
      headers: getMultipartHeaders(),
      body: formData,
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Erreur lors de l'upload du modèle");
  }

  return res.json();
};

/**
 * Supprime le document modèle de capture d'un type de document.
 */
export const deleteModeleCapture = async (typeDocumentId) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/type-documents/${typeDocumentId}/modele-capture/`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Erreur lors de la suppression du modèle");
  }

  return res.json();
};
