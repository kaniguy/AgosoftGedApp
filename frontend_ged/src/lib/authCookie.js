/** Cookie d'auth HttpOnly — le navigateur ne peut pas le lire (anti-XSS). */
export const AUTH_COOKIE = "ged_auth";
/** Marqueur non-HttpOnly pour l'UI (AuthGuard) — ne contient pas le secret. */
export const SESSION_FLAG_COOKIE = "ged_session";

const MAX_AGE_SECONDS = 60 * 60 * 12; // aligné sur TOKEN_TTL_HOURS par défaut

function cookieSecure() {
  return String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function sessionFlagCookieOptions() {
  return {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function setAuthCookies(response, token) {
  response.cookies.set(AUTH_COOKIE, token, authCookieOptions());
  response.cookies.set(SESSION_FLAG_COOKIE, "1", sessionFlagCookieOptions());
}

export function clearAuthCookies(response) {
  response.cookies.set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
  response.cookies.set(SESSION_FLAG_COOKIE, "", {
    ...sessionFlagCookieOptions(),
    maxAge: 0,
  });
}

export function getTokenFromRequest(request) {
  return request.cookies.get(AUTH_COOKIE)?.value || "";
}
