import { getApiUrl, resolveMediaUrl, apiFetch, resetAuthRedirectState, hasClientSession, clearAuthSession } from "./api";
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

// LOGIN — le jeton est posé en cookie HttpOnly par le proxy Next (jamais en localStorage)
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
      cause: err?.message,
    });
    return {
      success: false,
      error: USER_ERRORS.network,
    };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: toUserMessage(data.detail, USER_ERRORS.auth),
    };
  }

  // Nettoyage d'anciens tokens éventuels
  localStorage.removeItem("token");
  const user = buildUserFromAuthResponse(data);
  localStorage.setItem("user", JSON.stringify(user));
  resetAuthRedirectState();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("user-profile-updated"));
  }

  return {
    success: true,
    user,
    // Navigation dure recommandée pour que le cookie HttpOnly soit pris en compte
    redirectTo: "/",
  };
};

// LOGOUT — le proxy efface les cookies
export const logout = async () => {
  try {
    await apiFetch(`${getApiUrl()}/api/auth/logout/`, {
      method: "POST",
      headers: getHeadersSafe(),
    });
  } catch {
    // Backend injoignable : déconnexion locale quand même
  }

  clearAuthSession();
  return { success: true };
};

function getHeadersSafe() {
  return { "Content-Type": "application/json" };
}

// ME — rafraîchit modules, localités et permissions depuis le serveur
export async function getCurrentUser() {
  const res = await apiFetch(`${getApiUrl()}/api/auth/me/`, {
    headers: getHeadersSafe(),
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
  localStorage.removeItem("token");
  return syncUserStorage(buildUserFromAuthResponse(data));
}

/** Rafraîchit les droits d'accès si une session est présente (silencieux en cas d'erreur). */
export const refreshUserAccess = async () => {
  if (typeof window === "undefined" || !hasClientSession()) {
    return null;
  }
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
};
