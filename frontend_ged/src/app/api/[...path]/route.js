import { NextResponse } from "next/server";

function getBackend() {
  return (
    process.env.API_BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
}

export const maxDuration = 300;

async function proxyToDjango(request) {
  const backend = getBackend();
  const target = `${backend}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);

  // Pour que Django construise des URLs absolues avec l'hôte du client (LAN),
  // et non 127.0.0.1:9000 (hôte du proxy interne).
  const clientHost = request.headers.get("host");
  if (clientHost) {
    headers.set("x-forwarded-host", clientHost);
  }
  headers.set(
    "x-forwarded-proto",
    request.nextUrl.protocol.replace(":", "") || "http"
  );

  const init = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch {
    return NextResponse.json(
      { detail: "Backend Django injoignable." },
      { status: 502 }
    );
  }
}

export const GET = proxyToDjango;
export const POST = proxyToDjango;
export const PUT = proxyToDjango;
export const PATCH = proxyToDjango;
export const DELETE = proxyToDjango;
export const OPTIONS = proxyToDjango;
