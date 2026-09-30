import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "connect-src 'self' blob: data: https://www.youtube.com https://youtube.com",
      "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  // Django exige les trailing slashes (/api/auth/login/) — ne pas les retirer avant le proxy
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "2gb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return ["entreprise", "configuration-email", "notifications", "aide-video", "base-de-donnees"].map(
      (page) => ({
        source: `/gestion_acces/${page}`,
        destination: `/parametrage/${page}`,
        permanent: false,
      })
    );
  },
  // Évite que Turbopack prenne C:\Users\HP\ comme racine (lockfile parasite)
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: "./src/utils/empty-module.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
