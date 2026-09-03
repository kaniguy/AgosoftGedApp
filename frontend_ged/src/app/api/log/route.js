import { join } from "path";
import { prependLog } from "../../../lib/prependLog";

const LOG_FILE = join(process.cwd(), "logs", "logs_frontend");
const MAX_BODY_BYTES = 8 * 1024;
const MAX_MESSAGE_LENGTH = 2000;

function formatLine({ level = "info", scope = "app", message = "", details, at }) {
  const timestamp = at || new Date().toISOString();
  const suffix =
    details && Object.keys(details).length > 0
      ? ` ${JSON.stringify(details)}`
      : "";
  return `[${timestamp}] [${String(level).toUpperCase()}] [${scope}] ${message}${suffix}\n`;
}

export async function POST(request) {
  // Désactivé en production : endpoint ouvert = DoS disque / pollution de logs.
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    const body = JSON.parse(raw || "{}");
    const level = String(body.level || "info").slice(0, 16);
    const scope = String(body.scope || "app").slice(0, 64);
    const message = String(body.message || "").slice(0, MAX_MESSAGE_LENGTH);
    const details =
      body.details && typeof body.details === "object" && !Array.isArray(body.details)
        ? body.details
        : undefined;

    prependLog(
      LOG_FILE,
      formatLine({
        level,
        scope,
        message,
        details,
        at: typeof body.at === "string" ? body.at : undefined,
      }),
    );
  } catch {
    // Ne pas faire échouer l'application pour un log
  }

  return new Response(null, { status: 204 });
}
