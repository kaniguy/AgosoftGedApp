import { getApiUrl, getHeaders, apiFetch } from "./api";

export const PARAMETRAGE_DATA_CHANGED_EVENT = "parametrage-data-changed";

/** Nombre de structures, plans, types et champs (ordre de paramétrage), ou null si indisponible. */
export const getEtatParametrage = async () => {
  try {
    const res = await apiFetch(`${getApiUrl()}/api/parametrage/etat-parametrage/`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};
