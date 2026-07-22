/**
 * Persistance de l'état du plan géographique entre navigation.
 * Mémorise le chemin, les nœuds dépliés et la position de scroll avant d'ouvrir
 * la liste documents ou la page rattacher d'une localité.
 */

const STORAGE_KEY = "ged-gestion-plan-geo-return-state";

export const PLAN_GEO_PATH = "/gestion_documentaire/plan_geographique";
/** Paramètre requis pour rétablir l'arbre au retour depuis documents ou rattachement. */
export const PLAN_GEO_RESTORE_TREE_PARAM = "restoreTree";
export const PLAN_GEO_RESTORE_PATH = `${PLAN_GEO_PATH}?${PLAN_GEO_RESTORE_TREE_PARAM}=1`;

/** Enregistre l'état avant navigation (liste documents ou rattachement). */
export function savePlanGeoReturnState({ localiteId, navigationPath = [], expandedNodeIds = [], scrollTop = 0 }) {
  if (typeof window === "undefined" || !localiteId) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        localiteId: Number(localiteId),
        navigationPath: navigationPath.map(Number).filter(Boolean),
        expandedNodeIds: expandedNodeIds.map(Number).filter(Boolean),
        scrollTop: Number(scrollTop) || 0,
        savedAt: Date.now(),
      })
    );
  } catch {
    // quota / mode privé
  }
}

/** Lit l'état sauvegardé sans le supprimer. */
export function peekPlanGeoReturnState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.localiteId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Supprime l'état sauvegardé sans restauration (navigation depuis un autre module). */
export function clearPlanGeoReturnState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Lit puis supprime l'état sauvegardé (restauration unique). */
export function consumePlanGeoReturnState() {
  const state = peekPlanGeoReturnState();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return state;
}

/** Restaure le scroll du conteneur arbre après rendu des nœuds. */
export function restorePlanGeoScrollTop(scrollTop, containerId, { maxAttempts = 25, delayMs = 120 } = {}) {
  if (scrollTop == null || typeof window === "undefined") return;
  let attempts = 0;

  const apply = () => {
    const el = document.getElementById(containerId);
    if (el) {
      el.scrollTop = scrollTop;
      return true;
    }
    return false;
  };

  if (apply()) return;

  const timer = window.setInterval(() => {
    attempts += 1;
    if (apply() || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, delayMs);
}
