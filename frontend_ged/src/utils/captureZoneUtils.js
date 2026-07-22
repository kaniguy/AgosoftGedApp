/**
 * Utilitaires partagés pour les zones de capture (affichage, conversion, filtrage).
 */

/** Largeur de référence pour le rendu PDF (alignée sur PdfViewer). */
export const CAPTURE_BASE_PAGE_WIDTH = 720;

/** Palette de couleurs pour distinguer les zones à l'écran. */
export const ZONE_OVERLAY_COLORS = [
  { border: "border-blue-500", bg: "bg-blue-500/25", label: "text-blue-800" },
  { border: "border-emerald-500", bg: "bg-emerald-500/25", label: "text-emerald-800" },
  { border: "border-amber-500", bg: "bg-amber-500/25", label: "text-amber-800" },
  { border: "border-violet-500", bg: "bg-violet-500/25", label: "text-violet-800" },
  { border: "border-rose-500", bg: "bg-rose-500/25", label: "text-rose-800" },
  { border: "border-cyan-500", bg: "bg-cyan-500/25", label: "text-cyan-800" },
];

/**
 * Indique si un champ possède une zone de capture complète.
 */
export function champHasCaptureZone(champ) {
  return (
    champ?.zone_x != null &&
    champ?.zone_y != null &&
    champ?.zone_width > 0 &&
    champ?.zone_height > 0
  );
}

/**
 * Convertit des coordonnées normalisées (0–1) en pixels pour l'affichage.
 */
export function normalizedZoneToPixels(zone, pageWidth, pageHeight) {
  if (!zone || pageWidth <= 0 || pageHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: zone.zone_x * pageWidth,
    y: zone.zone_y * pageHeight,
    width: zone.zone_width * pageWidth,
    height: zone.zone_height * pageHeight,
  };
}

/**
 * Convertit des coordonnées pixels en zone normalisée (0–1).
 */
export function pixelsToNormalizedZone(x, y, width, height, pageWidth, pageHeight) {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }
  return {
    zone_x: Math.max(0, Math.min(1, x / pageWidth)),
    zone_y: Math.max(0, Math.min(1, y / pageHeight)),
    zone_width: Math.max(0.01, Math.min(1, width / pageWidth)),
    zone_height: Math.max(0.01, Math.min(1, height / pageHeight)),
  };
}

/**
 * Fusionne les champs avec des ajustements de zone locaux (écran rattachement).
 */
export function mergeChampsWithZoneOverrides(champs, overrides = {}) {
  if (!overrides || !Object.keys(overrides).length) {
    return champs || [];
  }
  return (champs || []).map((champ) => {
    const patch = overrides[champ.id];
    if (!patch) return champ;
    return { ...champ, ...patch };
  });
}

/**
 * Prépare le payload API des zones ajustées.
 */
export function zoneOverridesToPayload(overrides = {}) {
  return Object.entries(overrides).map(([champId, zone]) => ({
    champ_id: Number(champId),
    capture_page: zone.capture_page ?? 0,
    zone_x: zone.zone_x,
    zone_y: zone.zone_y,
    zone_width: zone.zone_width,
    zone_height: zone.zone_height,
  }));
}

/**
 * Filtre les champs dont la zone est visible sur la page donnée (index 0-based).
 */
export function filterZonesForPage(champs, pageIndex) {
  return (champs || []).filter((champ) => {
    if (!champHasCaptureZone(champ)) return false;
    return (champ.capture_page ?? 0) === pageIndex;
  });
}

/**
 * Compte le nombre de zones configurées par page.
 */
export function countZonesByPage(champs) {
  const counts = {};
  (champs || []).forEach((champ) => {
    if (!champHasCaptureZone(champ)) return;
    const page = champ.capture_page ?? 0;
    counts[page] = (counts[page] || 0) + 1;
  });
  return counts;
}
