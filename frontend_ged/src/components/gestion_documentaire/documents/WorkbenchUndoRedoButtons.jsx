/**
 * Boutons Annuler / Rétablir (style Word) pour le workbench document.
 */
"use client";

export default function WorkbenchUndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled = false,
  accent = "emerald",
}) {
  const hoverClass =
    accent === "yellow" ? "hover:bg-yellow-100 text-slate-700" : "hover:bg-emerald-100 text-slate-700";

  return (
    <div className="flex items-center gap-1 mb-2">
      <button
        type="button"
        title="Annuler (Ctrl+Z)"
        aria-label="Annuler"
        disabled={disabled || !canUndo}
        onClick={onUndo}
        className={`flex-1 flex items-center justify-center h-9 rounded-lg border border-slate-200 bg-white transition disabled:opacity-35 disabled:cursor-not-allowed ${hoverClass}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"
          />
        </svg>
      </button>
      <button
        type="button"
        title="Rétablir (Ctrl+Y)"
        aria-label="Rétablir"
        disabled={disabled || !canRedo}
        onClick={onRedo}
        className={`flex-1 flex items-center justify-center h-9 rounded-lg border border-slate-200 bg-white transition disabled:opacity-35 disabled:cursor-not-allowed ${hoverClass}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"
          />
        </svg>
      </button>
    </div>
  );
}
