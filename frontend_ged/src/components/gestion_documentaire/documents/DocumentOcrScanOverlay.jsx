"use client";

/**
 * Effet scanneur (rayon bleu) pendant l'extraction OCR sur l'aperçu document.
 */
export default function DocumentOcrScanOverlay({ progress = 0, onCancel }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className="absolute inset-0 z-40 overflow-hidden pointer-events-none" aria-live="polite">
      <div className="ged-ocr-scan-layer" aria-hidden="true">
        <div className="ged-ocr-scan-beam" />
        <div className="ged-ocr-scan-glow" />
      </div>

      <div className="absolute inset-0 bg-sky-500/[0.04]" aria-hidden="true" />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-white/95 border border-sky-200 shadow-lg shadow-sky-100/80 min-w-[200px]">
          <p className="text-xs font-semibold text-sky-900">Analyse en cours…</p>
          <p className="text-xl font-bold text-sky-600 tabular-nums leading-none">{safeProgress}%</p>
          <div className="w-full h-1.5 rounded-full bg-sky-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-[width] duration-300"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Annuler l&apos;extraction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
