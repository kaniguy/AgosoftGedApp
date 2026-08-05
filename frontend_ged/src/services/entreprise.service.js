import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";

const STORAGE_KEY = "entreprise";
const STORAGE_FETCHED_AT_KEY = "entreprise_fetched_at";
const CACHE_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_ENTREPRISE = {
  libelle: "AGOSOFT-GED",
  slogan: "Gestion Électronique de Documents",
  description: "",
  email: "",
  telephone: "",
  logo: null,
};

export const ENTREPRISE_LIMITS = {
  libelle: 50,
  description: 255,
  telephone: 30,
};

let inFlightEntreprisePromise = null;

function markEntrepriseFetched() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_FETCHED_AT_KEY, String(Date.now()));
}

function isEntrepriseCacheFresh() {
  if (typeof window === "undefined") return false;
  const fetchedAt = Number(localStorage.getItem(STORAGE_FETCHED_AT_KEY) || 0);
  return fetchedAt > 0 && Date.now() - fetchedAt < CACHE_TTL_MS;
}

export function getEntrepriseFromStorage() {
  if (typeof window === "undefined") return DEFAULT_ENTREPRISE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENTREPRISE;
    const data = JSON.parse(raw);
    return {
      ...DEFAULT_ENTREPRISE,
      ...data,
      logo: resolveMediaUrl(data?.logo),
    };
  } catch {
    return DEFAULT_ENTREPRISE;
  }
}

export function syncEntrepriseStorage(data) {
  if (typeof window === "undefined") return data;

  const payload = {
    libelle: data?.libelle || DEFAULT_ENTREPRISE.libelle,
    slogan: data?.slogan ?? DEFAULT_ENTREPRISE.slogan,
    description: data?.description ?? "",
    email: data?.email ?? "",
    telephone: data?.telephone ?? "",
    logo: resolveMediaUrl(data?.logo) || null,
    date_modification: data?.date_modification || null,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  markEntrepriseFetched();
  window.dispatchEvent(new CustomEvent("entreprise-updated"));
  return payload;
}

/** Lecture publique (connexion + en-tête), avec cache local et déduplication. */
export const getEntreprise = async ({ force = false } = {}) => {
  if (!force && isEntrepriseCacheFresh()) {
    return getEntrepriseFromStorage();
  }

  if (inFlightEntreprisePromise) {
    return inFlightEntreprisePromise;
  }

  inFlightEntreprisePromise = (async () => {
    const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/entreprise/`);

    if (!res.ok) {
      throw new Error("Impossible de charger les informations de l'entreprise");
    }

    const data = await res.json();
    return syncEntrepriseStorage(data);
  })();

  try {
    return await inFlightEntreprisePromise;
  } finally {
    inFlightEntreprisePromise = null;
  }
};

export const updateEntreprise = async (formData) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/entreprise/update/`, {
    method: "PUT",
    headers: getMultipartHeaders(),
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail ||
        data.libelle?.[0] ||
        data.email?.[0] ||
        data.description?.[0] ||
        "Erreur lors de la mise à jour"
    );
  }

  return syncEntrepriseStorage(data);
};

export const resetEntreprise = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/entreprise/reset/`, {
    method: "POST",
    headers: getHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Erreur lors de la réinitialisation");
  }

  return syncEntrepriseStorage(data);
};

/** Rafraîchit le branding si le cache est expiré (silencieux en cas d'erreur). */
export const refreshEntreprise = async ({ force = false } = {}) => {
  try {
    return await getEntreprise({ force });
  } catch {
    return getEntrepriseFromStorage();
  }
};
