import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";

const STORAGE_KEY = "entreprise";
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
  window.dispatchEvent(new CustomEvent("entreprise-updated"));
  return payload;
}

/** Lecture publique (connexion + en-tête). */
export const getEntreprise = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/entreprise/`);

  if (!res.ok) {
    throw new Error("Impossible de charger les informations de l'entreprise");
  }

  const data = await res.json();
  return syncEntrepriseStorage(data);
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

/** Rafraîchit le branding si besoin (silencieux en cas d'erreur). */
export const refreshEntreprise = async () => {
  try {
    return await getEntreprise();
  } catch {
    return getEntrepriseFromStorage();
  }
};
