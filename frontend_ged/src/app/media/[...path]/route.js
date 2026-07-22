import { NextResponse } from "next/server";

function getBackend() {
  return (
    process.env.API_BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
}

async function proxyMedia(request) {
  const backend = getBackend();
  const target = `${backend}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  const clientHost = request.headers.get("host");
  if (clientHost) {
    headers.set("x-forwarded-host", clientHost);
  }
  headers.set(
    "x-forwarded-proto",
    request.nextUrl.protocol.replace(":", "") || "http"
  );

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch {
    return NextResponse.json(
      { detail: "Fichier média injoignable." },
      { status: 502 }
    );
  }
}

export const GET = proxyMedia;
export const HEAD = proxyMedia;
