import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";

function normalizeSignature(item) {
  if (!item) return item;
  return {
    ...item,
    image_url: resolveMediaUrl(item.image_url) || item.image_url || null,
    has_password: Boolean(item.has_password),
  };
}

export const listUserSignatures = async () => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/signatures/`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les signatures");
  }
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.results || [];
  return items.map(normalizeSignature);
};

export const createUserSignature = async ({
  file,
  label = "",
  isDefault = false,
  password = "",
  passwordConfirm = "",
}) => {
  const formData = new FormData();
  formData.append("image", file);
  if (label) formData.append("label", label);
  if (isDefault) formData.append("is_default", "true");
  if (password) {
    formData.append("password", password);
    formData.append("password_confirm", passwordConfirm || password);
  }

  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/signatures/`, {
    method: "POST",
    headers: getMultipartHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.detail ||
      data.password?.[0] ||
      data.password_confirm?.[0] ||
      data.image?.[0] ||
      "Erreur lors de la création de la signature";
    throw new Error(message);
  }
  return normalizeSignature(data);
};

export const verifyUserSignaturePassword = async (id, password) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-acces/signatures/${id}/verify-password/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ password: password || "" }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Mot de passe incorrect.");
  }
  return data;
};

/** Définir, modifier ou retirer le mot de passe d'une signature existante. */
export const updateUserSignaturePassword = async (
  id,
  { password = "", passwordConfirm = "", currentPassword = "" } = {}
) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/signatures/${id}/`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({
      password: password || "",
      password_confirm: passwordConfirm || "",
      current_password: currentPassword || "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.detail ||
      data.current_password?.[0] ||
      data.password?.[0] ||
      data.password_confirm?.[0] ||
      "Impossible de mettre à jour le mot de passe";
    throw new Error(message);
  }
  return normalizeSignature(data);
};

export const deleteUserSignature = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/signatures/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    let message = "Impossible de supprimer la signature";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

export const setDefaultUserSignature = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-acces/signatures/${id}/set_default/`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Impossible de définir la signature par défaut");
  }
  return normalizeSignature(data);
};
