/**
 * Journalisation côté client : détails techniques vers logs_frontend (via /api/log).
 * Ne pas afficher ces messages à l'utilisateur final.
 */

function sendLog(level, scope, message, details = {}) {
  const payload = {
    level,
    scope,
    message,
    details,
    at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

export function logInfo(scope, message, details) {
  sendLog("info", scope, message, details);
}

export function logWarn(scope, message, details) {
  sendLog("warn", scope, message, details);
}

export function logError(scope, message, details) {
  sendLog("error", scope, message, details);
}
