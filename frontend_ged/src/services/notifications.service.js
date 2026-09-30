import { getApiUrl, getHeaders, apiFetch } from "./api";

const BASE = () => `${getApiUrl()}/api/gestion-acces/notifications`;

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError =
      data.detail ||
      data.non_field_errors?.[0] ||
      Object.values(data).flat?.()[0];
    throw new Error(firstError || "Une erreur est survenue.");
  }
  return data;
}

/** Configuration complète : règles, modèles, résumé périodique, variables. */
export const getNotificationsConfig = async () => {
  const res = await apiFetch(`${BASE()}/config/`, { headers: getHeaders() });
  return handleResponse(res);
};

/** Met à jour une règle d'envoi (activation, cible, options). */
export const updateRegleNotification = async (eventType, payload) => {
  const res = await apiFetch(`${BASE()}/regles/${eventType}/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

/** Met à jour un modèle d'e-mail (sujet, corps texte/HTML). */
export const updateModeleEmail = async (code, payload) => {
  const res = await apiFetch(`${BASE()}/modeles/${code}/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

/** Prévisualise un modèle avec des données d'exemple. */
export const previewModeleEmail = async (payload) => {
  const res = await apiFetch(`${BASE()}/modeles-preview/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

/** Réinitialise un modèle d'e-mail aux valeurs par défaut. */
export const resetModeleEmail = async (code) => {
  const res = await apiFetch(`${BASE()}/modeles/${code}/reset/`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse(res);
};

/** Met à jour la configuration du résumé périodique. */
export const updateConfigurationResume = async (payload) => {
  const res = await apiFetch(`${BASE()}/resume/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

/** Déclenche immédiatement l'envoi du résumé (test). */
export const envoyerResumeMaintenant = async () => {
  const res = await apiFetch(`${BASE()}/resume/envoyer/`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse(res);
};

/** Activation globale de chaque e-mail (superutilisateur uniquement). */
export const getNotificationsGenerales = async () => {
  const res = await apiFetch(`${BASE()}/generales/`, { headers: getHeaders() });
  return handleResponse(res);
};

export const updateNotificationsGenerales = async (payload) => {
  const res = await apiFetch(`${BASE()}/generales/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

/** Journal des notifications (filtres + pagination). */
export const getJournalNotifications = async ({
  eventType = "",
  statut = "",
  q = "",
  offset = 0,
  limit = 25,
} = {}) => {
  const params = new URLSearchParams();
  if (eventType) params.set("event_type", eventType);
  if (statut) params.set("statut", statut);
  if (q) params.set("q", q);
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  const res = await apiFetch(`${BASE()}/journal/?${params.toString()}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};
