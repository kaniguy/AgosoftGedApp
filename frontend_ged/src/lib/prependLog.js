import { readFileSync, writeFileSync, existsSync } from "fs";

/** Ajoute une ligne en tête du fichier (plus récent en haut). */
export function prependLog(file, line) {
  const text = line.endsWith("\n") ? line : `${line}\n`;
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  writeFileSync(file, text + existing, "utf8");
}
