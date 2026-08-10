import { join } from "path";
import { prependLog } from "./src/lib/prependLog.js";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const logFile = join(process.cwd(), "logs", "logs_frontend");
  const port = process.env.PORT || "3000";
  const line = `[${new Date().toISOString()}] Next.js ready on http://0.0.0.0:${port}/\n`;

  try {
    prependLog(logFile, line);
  } catch {
    // ignore
  }
}
