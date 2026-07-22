/**
 * CaptureZonesOverlay — Surlignage des zones de capture sur l'aperçu document.
 * Affiche les rectangles configurés et met en évidence les champs pré-remplis par l'OCR.
 */
"use client";

import {
  ZONE_OVERLAY_COLORS,
  champHasCaptureZone,
  filterZonesForPage,
  normalizedZoneToPixels,
} from "@/utils/captureZoneUtils";

/**
 * Détermine les classes CSS d'une zone selon son état (actif, rempli, défaut).
 */
function getZoneStyle({ isActive, isFilled, colorIndex }) {
  const palette = ZONE_OVERLAY_COLORS[colorIndex % ZONE_OVERLAY_COLORS.length];

  if (isActive) {
    return {
      box: `border-2 ${palette.border} ${palette.bg} ring-2 ring-offset-1 ring-emerald-400 z-30`,
      label: `${palette.label} font-bold`,
    };
  }
  if (isFilled) {
    return {
      box: `border-2 border-emerald-600 bg-emerald-400/30 z-20`,
      label: "text-emerald-900 font-semibold",
    };
  }
  return {
    box: `border-2 border-dashed ${palette.border} ${palette.bg} opacity-80 z-10`,
    label: palette.label,
  };
}

/**
 * Affiche les zones de capture par-dessus une page document (PDF ou image).
 */
export default function CaptureZonesOverlay({
  champs = [],
  pageIndex = 0,
  pageWidth = 0,
  pageHeight = 0,
  filledChampIds = [],
  activeChampId = null,
  showLabels = false,
  onActiveChampChange,
}) {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }

  const zonesOnPage = filterZonesForPage(champs, pageIndex);
  if (!zonesOnPage.length) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 ${onActiveChampChange ? "" : "pointer-events-none"}`}
      style={{ width: pageWidth, height: pageHeight }}
      aria-hidden={!onActiveChampChange}
    >
      {zonesOnPage.map((champ, index) => {
        if (!champHasCaptureZone(champ)) return null;

        const pixels = normalizedZoneToPixels(champ, pageWidth, pageHeight);
        const isFilled = filledChampIds.includes(champ.id);
        const isActive = activeChampId === champ.id;
        const style = getZoneStyle({ isActive, isFilled, colorIndex: index });

        return (
          <div
            key={champ.id}
            role={onActiveChampChange ? "button" : undefined}
            tabIndex={onActiveChampChange ? 0 : undefined}
            onClick={
              onActiveChampChange
                ? (e) => {
                    e.stopPropagation();
                    onActiveChampChange(champ.id);
                  }
                : undefined
            }
            onKeyDown={
              onActiveChampChange
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onActiveChampChange(champ.id);
                    }
                  }
                : undefined
            }
            className={`absolute box-border ${style.box} ${onActiveChampChange ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{
              left: pixels.x,
              top: pixels.y,
              width: pixels.width,
              height: pixels.height,
            }}
          >
            {showLabels && (
              <span
                className={`absolute -top-5 left-0 text-[10px] bg-white/90 px-1 rounded whitespace-nowrap max-w-[180px] truncate shadow-sm ${style.label}`}
              >
                {champ.libelle_champ}
                {isFilled ? " ✓" : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
