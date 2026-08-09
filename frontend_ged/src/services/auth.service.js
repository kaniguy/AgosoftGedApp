import { getApiUrl, getHeaders, resolveMediaUrl, apiFetch, resetAuthRedirectState } from "./api";
import { syncUserStorage } from "./profile.service";
import { logError } from "../utils/logger";
import { USER_ERRORS, toUserMessage } from "../utils/userError";

function buildUserFromAuthResponse(data) {
  const base = data.user || data;
  return {
    ...base,
    photo: resolveMediaUrl(base?.photo),
    modules: data.modules ?? base.modules ?? [],
    localites: data.localites ?? base.localites ?? [],
    permissions: data.permissions ?? base.permissions ?? [],
    is_superuser: data.is_superuser ?? base.is_superuser ?? false,
  };
}

// LOGIN
export const login = async (username, password) => {
  let res;
  try {
    res = await apiFetch(`${getApiUrl()}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    logError("auth.login", "Échec de connexion", {
      username,
      cause: err?.message,
    });
    return {
      success: false,
      error: USER_ERRORS.network,
    };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.token) {
    return {
      success: false,
      error: toUserMessage(data.detail, USER_ERRORS.auth),
    };
  }

  localStorage.setItem("token", data.token);
  const user = buildUserFromAuthResponse(data);
  localStorage.setItem("user", JSON.stringify(user));
  resetAuthRedirectState();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("user-profile-updated"));
  }

  return {
    success: true,
    token: data.token,
    user,
  };
};

// LOGOUT
export const logout = async () => {
  try {
    await apiFetch(`${getApiUrl()}/api/auth/logout/`, {
      method: "POST",
      headers: getHeaders(),
    });
  } catch {
    // Backend injoignable : déconnexion locale quand même
  }

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  return { success: true };
};

// ME — rafraîchit modules, localités et permissions depuis le serveur
export async function getCurrentUser() {
  const res = await apiFetch(`${getApiUrl()}/api/auth/me/`, {
    headers: getHeaders(),
    suppressAuthRedirect: true,
  });

  if (!res.ok) {
    let message = "Impossible de charger la session";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      // ignore
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  resetAuthRedirectState();
  return syncUserStorage(buildUserFromAuthResponse(data));
}

/** Rafraîchit les droits d'accès si un token est présent (silencieux en cas d'erreur). */
export const refreshUserAccess = async () => {
  if (typeof window === "undefined" || !localStorage.getItem("token")) {
    return null;
  }
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
};
