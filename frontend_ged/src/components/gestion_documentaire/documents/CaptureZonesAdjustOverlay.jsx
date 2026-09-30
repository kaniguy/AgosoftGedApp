/**
 * CaptureZonesAdjustOverlay — Zones déplaçables / redimensionnables sur l'aperçu rattachement.
 */
"use client";

import { Rnd } from "react-rnd";
import {
  ZONE_OVERLAY_COLORS,
  champHasCaptureZone,
  filterZonesForPage,
  normalizedZoneToPixels,
  pixelsToNormalizedZone,
} from "@/utils/captureZoneUtils";
import { cssZoomOf } from "@/utils/appZoom";

export default function CaptureZonesAdjustOverlay({
  champs = [],
  pageIndex = 0,
  pageWidth = 0,
  pageHeight = 0,
  filledChampIds = [],
  activeChampId = null,
  onActiveChampChange,
  onZoneChange,
}) {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }

  const zonesOnPage = filterZonesForPage(champs, pageIndex);
  if (!zonesOnPage.length) {
    return null;
  }

  const handleZoneUpdate = (champ, position, size) => {
    const normalized = pixelsToNormalizedZone(
      position.x,
      position.y,
      size.width,
      size.height,
      pageWidth,
      pageHeight
    );
    if (!normalized) return;
    onZoneChange?.(champ.id, {
      ...normalized,
      capture_page: pageIndex,
    });
  };

  return (
    <div
      className="absolute inset-0 z-20 capture-zone-adjust"
      style={{ width: pageWidth, height: pageHeight }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {zonesOnPage.map((champ, index) => {
        if (!champHasCaptureZone(champ)) return null;

        const pixels = normalizedZoneToPixels(champ, pageWidth, pageHeight);
        const isActive = activeChampId === champ.id;
        const isFilled = filledChampIds.includes(champ.id);
        const palette = ZONE_OVERLAY_COLORS[index % ZONE_OVERLAY_COLORS.length];
        const colorClass = `${palette.border} ${palette.bg}`;

        return (
          <Rnd
            key={champ.id}
            size={{ width: pixels.width, height: pixels.height }}
            position={{ x: pixels.x, y: pixels.y }}
            bounds="parent"
            scale={cssZoomOf()}
            enableResizing={isActive}
            disableDragging={false}
            onPointerDown={(e) => {
              e.stopPropagation();
              onActiveChampChange?.(champ.id);
            }}
            onDragStop={(_e, data) =>
              handleZoneUpdate(champ, { x: data.x, y: data.y }, {
                width: pixels.width,
                height: pixels.height,
              })
            }
            onResizeStop={(_e, _dir, ref, _delta, position) =>
              handleZoneUpdate(champ, position, {
                width: parseFloat(ref.style.width),
                height: parseFloat(ref.style.height),
              })
            }
            className={`border-2 box-border cursor-move capture-zone-adjust ${colorClass} ${
              isActive ? "z-30 ring-2 ring-emerald-400" : "z-10 opacity-90"
            } ${isFilled ? "border-emerald-600 bg-emerald-400/30" : ""}`}
          />
        );
      })}
    </div>
  );
}
