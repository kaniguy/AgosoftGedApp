import { join } from "path";
import { prependLog } from "../../../lib/prependLog";

const LOG_FILE = join(process.cwd(), "logs", "logs_frontend");

function formatLine({ level = "info", scope = "app", message = "", details, at }) {
  const timestamp = at || new Date().toISOString();
  const suffix =
    details && Object.keys(details).length > 0
      ? ` ${JSON.stringify(details)}`
      : "";
  return `[${timestamp}] [${String(level).toUpperCase()}] [${scope}] ${message}${suffix}\n`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    prependLog(LOG_FILE, formatLine(body));
  } catch {
    // Ne pas faire échouer l'application pour un log
  }

  return new Response(null, { status: 204 });
}
