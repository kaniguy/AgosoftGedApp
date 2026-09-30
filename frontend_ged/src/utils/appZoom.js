/**
 * Zoom CSS effectif d'un élément (zoom global de l'app × zooms locaux éventuels).
 *
 * Avec `zoom`, getBoundingClientRect(), clientX/clientY et window.innerWidth/innerHeight
 * sont en pixels écran, alors que style.left/width, offsetWidth, scrollTop… sont en pixels CSS
 * de l'élément : diviser les premiers par ce facteur pour obtenir les seconds.
 */
export function cssZoomOf(el) {
  if (typeof document === "undefined") return 1;
  const node = el || document.documentElement;
  const zoom = node.currentCSSZoom;
  if (typeof zoom === "number" && zoom > 0) return zoom;
  if (node.offsetWidth > 0) {
    const ratio = node.getBoundingClientRect().width / node.offsetWidth;
    if (ratio > 0 && Number.isFinite(ratio)) return ratio;
  }
  return 1;
}

/** Taille de la fenêtre en pixels CSS de l'app (équivalent de innerWidth/innerHeight sous zoom). */
export function appViewportSize() {
  const zoom = cssZoomOf();
  return { width: window.innerWidth / zoom, height: window.innerHeight / zoom };
}
