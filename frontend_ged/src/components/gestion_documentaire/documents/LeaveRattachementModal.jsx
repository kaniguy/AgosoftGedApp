"use client";

/**
 * Modale affichée lors d'une tentative de quitter le rattachement avec un lot en cours.
 */
export default function LeaveRattachementModal({
  open,
  busy = false,
  onSaveDraft,
  onDeleteDraft,
  onContinueEditing,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-rattachement-title"
      >
        <button
          type="button"
          onClick={onContinueEditing}
          disabled={busy}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
          title="Continuer l'édition"
          aria-label="Continuer l'édition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 id="leave-rattachement-title" className="text-lg font-semibold text-slate-800 pr-8">
            Quitter le rattachement ?
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Vous avez un lot en cours de saisie. Que souhaitez-vous faire avant de quitter cette
            page ?
          </p>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-6">
          <button
            type="button"
            disabled={busy}
            onClick={onSaveDraft}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer au brouillon"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteDraft}
            className="w-full px-4 py-2.5 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            {busy ? "Suppression…" : "Supprimer le brouillon"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onContinueEditing}
            className="w-full px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            Continuer l&apos;édition
          </button>
        </div>
      </div>
    </div>
  );
}
