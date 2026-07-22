/**
 * Variables d'environnement frontend — définies dans .env.local / Docker.
 *
 * Next.js remplace statiquement process.env.NEXT_PUBLIC_* au moment du build.
 * Ces constantes sont disponibles côté serveur ET côté client.
 *
 * API_BACKEND_INTERNAL_URL : URL Docker interne (ex. http://backend:8000)
 * utilisée uniquement par le proxy Next.js côté serveur.
 */
export const API_BACKEND_URL = (process.env.NEXT_PUBLIC_API_BACKEND_URL ?? "").replace(/\/$/, "");
export const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? "8000";
export const API_BACKEND_INTERNAL_URL = (
  process.env.API_BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BACKEND_URL ||
  ""
).replace(/\/$/, "");
