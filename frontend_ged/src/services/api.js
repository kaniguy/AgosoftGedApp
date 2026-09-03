/**
 * Évite les échecs quand le navigateur résout localhost en IPv6 (::1)
 * alors que Django écoute sur 127.0.0.1 (IPv4).
 */
import { logError } from "../utils/logger";
import { USER_ERRORS } from "../utils/userError";
import { SESSION_FLAG_COOKIE } from "../lib/authCookie";

/**
 * URL de l'API — toujours same-origin (proxy Next → Django).
 * Le navigateur ne parle jamais directement au port 9000.
 */
export function getApiUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.API_BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
}

function hasSessionHint() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_FLAG_COOKIE}=`));
}

/** fetch avec credentials (cookie HttpOnly) + message générique si injoignable */
export async function apiFetch(url, options = {}) {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
    });
    if (
      res.status === 401 &&
      !suppressAuthRedirect &&
      typeof window !== "undefined" &&
      requestHadAuth(fetchOptions)
    ) {
      handleAuthFailure();
    }
    return res;
  } catch (err) {
    logError("apiFetch", "Serveur API injoignable", {
      url,
      cause: err?.message,
    });
    throw new Error(USER_ERRORS.network);
  }
}

/** @deprecated Préférez getApiUrl() */
export const API_URL = getApiUrl();

let redirectingToLogin = false;

/** Supprime les données utilisateur + cookies de session (y compris HttpOnly). */
export async function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = `${SESSION_FLAG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    await fetch("/api/session/clear", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

/** Réinitialise le verrou de redirection (après connexion réussie). */
export function resetAuthRedirectState() {
  redirectingToLogin = false;
}

/** Redirige vers la connexion si la session n'est plus valide côté serveur. */
export function handleAuthFailure() {
  if (typeof window === "undefined" || redirectingToLogin) return;

  const path = window.location.pathname;
  if (path === "/auth/login" || path.startsWith("/telechargement/")) return;
  if (!hasSessionHint() && !localStorage.getItem("user")) return;

  redirectingToLogin = true;
  clearAuthSession();
  window.location.replace("/auth/login?session=expired");
}

function requestHadAuth(options = {}) {
  if (hasSessionHint() || localStorage.getItem("user")) return true;
  const headers = options.headers;
  if (!headers) return false;
  if (headers instanceof Headers) {
    return Boolean(headers.get("authorization") || headers.get("Authorization"));
  }
  return Boolean(headers.Authorization || headers.authorization);
}

export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  let path = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      const isLocal =
        !parsed.hostname ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]" ||
        parsed.hostname === "backend" ||
        parsed.hostname === "agosoftged-backend";
      if (isLocal) {
        path = `${parsed.pathname}${parsed.search}`;
      } else if (
        typeof window !== "undefined" &&
        parsed.origin === window.location.origin
      ) {
        path = `${parsed.pathname}${parsed.search}`;
      } else {
        return url;
      }
    } catch {
      return url;
    }
  }

  const base = getApiUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Headers JSON — l'auth passe par le cookie HttpOnly (credentials: include). */
export const getHeaders = () => ({
  "Content-Type": "application/json",
});

/** Headers multipart (upload) — idem, cookie HttpOnly. */
export const getMultipartHeaders = () => ({});

export function hasClientSession() {
  return hasSessionHint() || Boolean(localStorage.getItem("user"));
}
