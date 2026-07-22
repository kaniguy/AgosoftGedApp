/** Découpe un libellé contenant « + » en plusieurs entrées (ex. Paris + Abidjan + Dakar). */
export function parseLibellesFromPlus(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hasMultipleLibelles(value) {
  return parseLibellesFromPlus(value).length > 1;
}

export function libelleToCode(libelle, maxLen = 10) {
  const normalized = libelle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!normalized) return "ITEM";
  return normalized.slice(0, maxLen);
}

export function uniqueCodeFromLibelle(libelle, existsFn, maxLen = 10) {
  const base = libelleToCode(libelle, maxLen);
  if (!existsFn(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const suffix = String(i);
    const candidate = `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
    if (!existsFn(candidate)) return candidate;
  }
  return `${base.slice(0, 6)}${Date.now().toString(36).slice(-3)}`.toUpperCase();
}
