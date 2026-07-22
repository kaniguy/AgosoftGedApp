import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";

export function syncUserStorage(userData) {
  if (typeof window === "undefined") return userData;

  const photo = resolveMediaUrl(userData?.photo);
  const signature = resolveMediaUrl(userData?.signature);
  const existing = JSON.parse(localStorage.getItem("user") || "{}");
  const updated = {
    ...existing,
    ...userData,
    photo: photo || null,
    signature: signature || null,
  };

  localStorage.setItem("user", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("user-profile-updated"));
  return updated;
}

export const getProfile = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/profile/`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    let message = "Impossible de charger le profil";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json();
  return syncUserStorage(data);
};

export const updateProfile = async (formData) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/profile/`, {
    method: "PUT",
    headers: getMultipartHeaders(),
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || data.email?.[0] || "Erreur lors de la mise à jour du profil");
  }

  return syncUserStorage(data);
};

/** Enregistre (ou remplace) la signature du compte utilisateur. */
export const updateUserSignature = async (file) => {
  const formData = new FormData();
  formData.append("signature", file);
  return updateProfile(formData);
};

/** Supprime la signature du compte utilisateur. */
export const removeUserSignature = async () => {
  const formData = new FormData();
  formData.append("remove_signature", "true");
  return updateProfile(formData);
};
