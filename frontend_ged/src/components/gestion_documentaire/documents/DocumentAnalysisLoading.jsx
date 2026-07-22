// Indicateur de chargement pendant l'analyse OCR du document importé
"use client";

function SkeletonField({ fullWidth = false }) {
  return (
    <div className={fullWidth ? "col-span-full" : ""}>
      <div className="h-4 w-24 bg-emerald-100/80 rounded animate-pulse mb-2" />
      <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
    </div>
  );
}

/**
 * Overlay affiché pendant l'analyse OCR / extraction des champs du document.
 */
export default function DocumentAnalysisLoading({ columnCount = 3, fileName = "", progress = 0, onCancel }) {
  const gridClass =
    columnCount >= 3
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
      : columnCount >= 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1";

  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const phaseLabel =
    safeProgress < 28
      ? "Envoi du document…"
      : safeProgress < 85
        ? "Extraction des champs (OCR)…"
        : safeProgress < 100
          ? "Traitement sur le serveur…"
          : "Terminé";

  return (
    <div className="relative min-h-[220px] rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white overflow-hidden">
      <div className={`grid ${gridClass} gap-4 p-1 opacity-40 pointer-events-none select-none`} aria-hidden="true">
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonField fullWidth />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[2px] px-6 text-center">
        <div className="relative mb-5">
          <div className="h-14 w-14 rounded-full border-4 border-emerald-100" />
          <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-transparent border-t-emerald-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-700 tabular-nums">{safeProgress}%</span>
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-800">Analyse du document en cours</p>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">
          Extraction automatique des champs
          {fileName ? (
            <>
              {" "}
              — <span className="font-medium text-gray-600">{fileName}</span>
            </>
          ) : (
            "…"
          )}
        </p>

        <div className="mt-5 w-56 max-w-full">
          <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${safeProgress}%` }}
              role="progressbar"
              aria-valuenow={safeProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-medium">{phaseLabel}</p>
        </div>

        <p className="text-[11px] text-gray-400 mt-3">
          Veuillez patienter, les champs seront pré-remplis automatiquement
        </p>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            Annuler l&apos;extraction
          </button>
        )}
      </div>
    </div>
  );
}
