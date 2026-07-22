import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.24"],
  // Django exige les trailing slashes (/api/auth/login/) — ne pas les retirer avant le proxy
  skipTrailingSlashRedirect: true,
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
