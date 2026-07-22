/**
 * Sélecteur de champ + page pour une zone de capture (barre d'aperçu, compact).
 */
"use client";

import { champHasCaptureZone } from "@/utils/captureZoneUtils";

export default function CaptureZonePageControls({
  visible = false,
  variant = "toolbar",
  zoneChamps = [],
  activeChampId = null,
  activeChamp = null,
  pageCount = 1,
  currentPage = 1,
  onChampSelect,
  onNextChamp,
  onPageSelect,
  onAssignCurrentPage,
  accent = "emerald",
}) {
  if (!visible || !zoneChamps.length) {
    return null;
  }

  const resolvedChamp =
    activeChamp ||
    zoneChamps.find((c) => c.id === activeChampId) ||
    zoneChamps[0];

  if (!resolvedChamp || !champHasCaptureZone(resolvedChamp)) {
    return null;
  }

  const zonePage = resolvedChamp.capture_page ?? 0;
  const onOtherPage = zonePage !== currentPage - 1;
  const focusRing =
    accent === "yellow"
      ? "focus:ring-yellow-400 focus:border-yellow-400"
      : "focus:ring-emerald-500 focus:border-emerald-500";
  const assignBtn =
    accent === "yellow"
      ? "border-yellow-300 text-yellow-800 hover:bg-yellow-50"
      : "border-emerald-300 text-emerald-800 hover:bg-emerald-50";
  const nextBtn =
    accent === "yellow"
      ? "border-yellow-300 text-yellow-800 hover:bg-yellow-50"
      : "border-emerald-300 text-emerald-800 hover:bg-emerald-50";

  if (variant === "toolbar") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 shrink-0 flex-wrap max-w-full">
        <label className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
          <select
            value={resolvedChamp.id}
            onChange={(e) => onChampSelect?.(Number(e.target.value))}
            className={`h-6 max-w-[130px] border border-slate-300 rounded px-1 text-[11px] bg-white truncate ${focusRing}`}
            aria-label="Champ de la zone"
          >
            {zoneChamps.map((champ) => (
              <option key={champ.id} value={champ.id}>
                {champ.libelle_champ}
              </option>
            ))}
          </select>
        </label>
        <span className="text-slate-300" aria-hidden>
          |
        </span>
        <label className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
          Page zone
          <select
            value={zonePage + 1}
            onChange={(e) => onPageSelect?.(Number(e.target.value) - 1)}
            className={`h-6 min-w-[3rem] border border-slate-300 rounded px-1 text-[11px] bg-white ${focusRing}`}
            aria-label={`Page de la zone ${resolvedChamp.libelle_champ}`}
          >
            {Array.from({ length: Math.max(1, pageCount) }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        {onOtherPage && (
          <button
            type="button"
            onClick={onAssignCurrentPage}
            title={`Déplacer la zone sur la page ${currentPage}`}
            className={`h-6 px-1.5 rounded border text-[10px] font-medium whitespace-nowrap transition ${assignBtn}`}
          >
            → p.{currentPage}
          </button>
        )}
        {zoneChamps.length > 1 && onNextChamp && (
          <button
            type="button"
            onClick={onNextChamp}
            title="Champ suivant"
            className={`h-6 px-1.5 rounded border text-[10px] font-medium whitespace-nowrap transition ${nextBtn}`}
          >
            Champ suivant →
          </button>
        )}
      </div>
    );
  }

  return null;
}
