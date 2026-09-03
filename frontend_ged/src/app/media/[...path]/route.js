import { NextResponse } from "next/server";
import { getTokenFromRequest } from "../../../lib/authCookie";

function getBackend() {
  return (
    process.env.API_BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
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
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

async function proxyMedia(request) {
  const cookieToken = getTokenFromRequest(request);
  const token =
    request.headers.get("authorization") ||
    (cookieToken ? `Token ${cookieToken}` : "");

  const backend = getBackend();
  const target = `${backend}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  if (token) headers.set("authorization", token);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const clientHost = request.headers.get("host");
  if (clientHost) {
    headers.set("x-forwarded-host", clientHost);
  }
  headers.set(
    "x-forwarded-proto",
    request.nextUrl.protocol.replace(":", "") || "http",
  );

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: filterResponseHeaders(upstream),
    });
  } catch {
    return NextResponse.json(
      { detail: "Fichier média injoignable." },
      { status: 502 },
    );
  }
}

export const GET = proxyMedia;
export const HEAD = proxyMedia;
