/**
 * Évite les échecs quand le navigateur résout localhost en IPv6 (::1)
 * alors que Django écoute sur 127.0.0.1 (IPv4).
 */
import { API_BACKEND_URL, API_PORT } from "../config/env";
import { logError } from "../utils/logger";
import { USER_ERRORS } from "../utils/userError";

function resolveApiHost(hostname) {
  if (!hostname || hostname === "localhost" || hostname === "[::1]") {
    return "127.0.0.1";
  }
  return hostname;
}

function isLocalHost(hostname) {
  return !hostname || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * URL de l'API Django.
 * - localhost : connexion directe au port 9000 (fiable en dev local).
 * - IP réseau (192.168.x.x) : même origine Next.js (proxy /api → Django).
 */
export function getApiUrl() {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (!isLocalHost(hostname)) {
      return window.location.origin;
    }
    return `http://${resolveApiHost(hostname)}:${API_PORT}`;
  }

  return API_BACKEND_URL;
}

/** fetch avec message explicite si le backend est injoignable */
export async function apiFetch(url, options = {}) {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  try {
    const res = await fetch(url, fetchOptions);
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
    const hint =
      typeof window !== "undefined"
        ? "Vérifiez que Django tourne (python manage.py runserver) puis redémarrez Next.js (npm run dev)."
        : "Démarrez le backend : python manage.py runserver";
    logError("apiFetch", `Serveur API injoignable (${getApiUrl()}). ${hint}`, {
      url,
      cause: err?.message,
    });
    throw new Error(USER_ERRORS.network);
  }
}

/** @deprecated Préférez getApiUrl() */
export const API_URL = API_BACKEND_URL;

let redirectingToLogin = false;

/** Supprime le jeton et les données utilisateur du navigateur. */
export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
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
  if (!localStorage.getItem("token")) return;

  redirectingToLogin = true;
  clearAuthSession();
  window.location.replace("/auth/login?session=expired");
}

function requestHadAuth(options = {}) {
  if (localStorage.getItem("token")) return true;
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

  // Django renvoie souvent http://127.0.0.1:9000/media/... via le proxy Next.
  // Sur un autre PC du réseau, localhost pointe vers la machine cliente → Failed to fetch.
  // On extrait le chemin et on le rebascule sur getApiUrl() (origine courante en LAN).
  let path = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      if (isLocalHost(parsed.hostname)) {
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

// Headers JSON + Token
export const getHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Token ${token}`;
    }
  }

  return headers;
};

// Headers multipart (upload)
export const getMultipartHeaders = () => {
  const headers = {};

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Token ${token}`;
    }
  }

  return headers;
};
