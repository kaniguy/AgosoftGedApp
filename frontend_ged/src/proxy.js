import { NextResponse } from "next/server";

/** Fichiers statiques du dossier public (worker PDF, icônes, etc.). */
const STATIC_FILE_RE =
  /\.(?:mjs|js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|txt|json)$/i;

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const isLogin = pathname === "/auth/login" || pathname.startsWith("/auth/login/");
  const isTelechargement = pathname.startsWith("/telechargement/");
  const isAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/media/") ||
    STATIC_FILE_RE.test(pathname);

  if (isLogin || isTelechargement || isAsset) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ged_auth")?.value;
  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Exclure assets Next + fichiers statiques publics (dont pdf.worker.min.mjs),
     * ainsi que /api et /media : sinon Next garde en mémoire tout le corps des
     * envois (archives de restauration, documents) avant de les transmettre.
     */
    "/((?!_next/static|_next/image|api/|media/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|mjs|js|css|map|woff2?|ttf|eot)$).*)",
  ],
};
