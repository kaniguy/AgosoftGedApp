import { join } from "path";
import { prependLog } from "./prependLog";

const LOG_FILE = join(process.cwd(), "logs_frontend");

function prependLine(line) {
  try {
    prependLog(LOG_FILE, line);
  } catch {
    // ignore
  }
}

function formatAccessLine(method, path, status, size = 0) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const time = now.toTimeString().slice(0, 8);
  const stamp = `${day}/${month}/${year} ${time}`;
  return `[${stamp}] "${method} ${path} HTTP/1.1" ${status} ${size}\n`;
}

/** Ligne de requête HTTP (format proche de runserver / next dev). */
export function logAccess(method, path, status, size = 0) {
  prependLine(formatAccessLine(method, path, status, size));
}

/** Message libre (démarrage serveur, erreurs, etc.). */
export function logServer(message) {
  const stamp = new Date().toISOString();
  prependLine(`[${stamp}] ${message}\n`);
}

export function logStartup() {
  const port = process.env.PORT || "3000";
  logServer(`Next.js ready on http://0.0.0.0:${port}/`);
}
