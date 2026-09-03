import { readFileSync, writeFileSync, existsSync } from "fs";

export function fileLogsEnabled() {
  return String(process.env.GED_FILE_LOGS || "").trim().toLowerCase() === "true"
    || String(process.env.GED_FILE_LOGS || "").trim() === "1";
}

/** Ajoute une ligne en tête du fichier (plus récent en haut). */
export function prependLog(file, line) {
  if (!fileLogsEnabled()) return;
  const text = line.endsWith("\n") ? line : `${line}\n`;
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  writeFileSync(file, text + existing, "utf8");
}
