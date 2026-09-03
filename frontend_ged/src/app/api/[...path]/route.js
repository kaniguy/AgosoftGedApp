import { NextResponse } from "next/server";
import { logAccess } from "../../../lib/serverLogger";
import {
  clearAuthCookies,
  getTokenFromRequest,
  setAuthCookies,
} from "../../../lib/authCookie";

function getBackend() {
  return (
    process.env.API_BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
}

/** Préfixes API autorisés via le proxy (pas d'admin Django). */
const ALLOWED_PREFIXES = [
  "/api/auth/",
  "/api/parametrage/",
  "/api/gestion-acces/",
  "/api/gestion-documentaire/",
];

export const maxDuration = 300;

function isAllowedPath(pathname) {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  );
}

function filterResponseHeaders(upstream) {
  const headers = new Headers();
  const pass = [
    "content-type",
    "content-length",
    "content-disposition",
    "cache-control",
    "accept-ranges",
    "content-range",
  ];
  for (const name of pass) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxyToDjango(request) {
  const pathname = request.nextUrl.pathname;

  if (!isAllowedPath(pathname)) {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }

  const backend = getBackend();
  if (!backend) {
    return NextResponse.json(
      { detail: "Configuration API manquante." },
      { status: 500 },
    );
  }

  const target = `${backend}${pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const incomingLength = request.headers.get("content-length");
  if (incomingLength) headers.set("content-length", incomingLength);

  // Priorité : header client explicite, sinon cookie HttpOnly.
  // Exception : login / endpoints publics — ne pas envoyer un ancien jeton
  // (DRF échoue avec "Jeton invalide" même sur AllowAny).
  const jobConfirm = request.headers.get("x-sauvegarde-confirmation");
  if (jobConfirm) headers.set("x-sauvegarde-confirmation", jobConfirm);
  const authorization = request.headers.get("authorization");
  const cookieToken = getTokenFromRequest(request);
  const isLogin =
    pathname === "/api/auth/login/" || pathname === "/api/auth/login";
  const isPublicDownload =
    pathname.includes("/telechargement/") &&
    (pathname.endsWith("/info/") ||
      pathname.endsWith("/info") ||
      pathname.endsWith("/fichier/") ||
      pathname.endsWith("/fichier") ||
      pathname.match(/\/telechargement\/[^/]+\/?$/));

  if (authorization) {
    headers.set("authorization", authorization);
  } else if (cookieToken && !isLogin && !isPublicDownload) {
    headers.set("authorization", `Token ${cookieToken}`);
  }

  const clientHost = request.headers.get("host");
  if (clientHost) {
    headers.set("x-forwarded-host", clientHost);
  }
  headers.set(
    "x-forwarded-proto",
    request.nextUrl.protocol.replace(":", "") || "http",
  );

  const forwardedFor =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";
  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor.split(",")[0].trim());
  }

  const init = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(target, init);
    const contentLength = upstream.headers.get("content-length");
    const size = contentLength ? Number(contentLength) : 0;
    logAccess(
      request.method,
      pathname,
      upstream.status,
      Number.isFinite(size) ? size : 0,
    );

    const isLoginResp =
      pathname === "/api/auth/login/" || pathname === "/api/auth/login";
    const isLogout =
      pathname === "/api/auth/logout/" || pathname === "/api/auth/logout";

    if (isLoginResp && upstream.ok) {
      const data = await upstream.json();
      const token = data.token;
      const { token: _omit, ...safe } = data;
      const response = NextResponse.json(safe, { status: upstream.status });
      if (token) {
        setAuthCookies(response, token);
      }
      return response;
    }

    // Login échoué : effacer un éventuel ancien cookie pour éviter la boucle
    if (isLoginResp && !upstream.ok) {
      const body = await upstream.arrayBuffer();
      const response = new NextResponse(body, {
        status: upstream.status,
        headers: filterResponseHeaders(upstream),
      });
      clearAuthCookies(response);
      return response;
    }

    if (isLogout) {
      const body = await upstream.arrayBuffer();
      const response = new NextResponse(body, {
        status: upstream.status,
        headers: filterResponseHeaders(upstream),
      });
      clearAuthCookies(response);
      return response;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await upstream.arrayBuffer();
      return new NextResponse(body, {
        status: upstream.status,
        headers: filterResponseHeaders(upstream),
      });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: filterResponseHeaders(upstream),
    });
  } catch {
    logAccess(request.method, pathname, 502, 0);
    return NextResponse.json(
      { detail: "Backend Django injoignable." },
      { status: 502 },
    );
  }
}

export const GET = proxyToDjango;
export const POST = proxyToDjango;
export const PUT = proxyToDjango;
export const PATCH = proxyToDjango;
export const DELETE = proxyToDjango;
export const OPTIONS = proxyToDjango;
