/**
 * Normalise une valeur de champ QR en URL http(s) cliquable, ou null si ce n’est pas une URL.
 */
export function normalizeHttpUrl(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;

  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;

  // domaine.tld[/chemin] sans schéma (évite les textes libres)
  if (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}([/:?#][^\s]*)?$/i.test(v)) {
    return `https://${v}`;
  }

  return null;
}

export function isHttpUrl(value) {
  return Boolean(normalizeHttpUrl(value));
}
