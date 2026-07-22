/** Rafraîchissement des totaux par statut dans le menu Contrôle qualité. */

export const CONTROLE_QUALITE_STATS_UPDATED = "controle-qualite-stats-updated";

export function notifyControleQualiteStatsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTROLE_QUALITE_STATS_UPDATED));
  }
}
