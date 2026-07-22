"use client";

export default function DocumentSaveModeModal({ open, onClose, onConfirm, busy, versionCourante = 1 }) {
  if (!open) return null;

  const currentVersion = versionCourante ?? 1;
  const nextVersion = currentVersion + 1;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Enregistrer les modifications</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              Version active : v{currentVersion}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Choisissez comment conserver les changements apportés au document (fichier, index ou
            annotations).
          </p>
        </div>
        <div className="p-6 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm("overwrite")}
            className="w-full text-left p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition disabled:opacity-50"
          >
            <span className="block font-semibold text-emerald-800">Écraser la version courante</span>
            <span className="block text-sm text-slate-600 mt-1">
              Remplace le document actuel (v{currentVersion}). L&apos;ancienne version est archivée
              dans l&apos;historique.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm("new_version")}
            className="w-full text-left p-4 rounded-xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
          >
            <span className="block font-semibold text-blue-800">Créer une nouvelle version</span>
            <span className="block text-sm text-slate-600 mt-1">
              Conserve l&apos;historique et passe le document à la version v{nextVersion}.
            </span>
          </button>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
