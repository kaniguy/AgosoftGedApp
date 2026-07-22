/**
 * Menu de sélection des colonnes visibles du tableau documents.
 *
 * Rôle : bouton « Colonnes visibles » avec panneau ancré (cases à cocher,
 * tout cocher / tout décocher). Le menu défile avec le bouton (position absolute).
 * Utilisé par DocumentListeGlobale et DocumentListePanel.
 */
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * @param {Object} props
 * @param {Array} props.allColumns - Toutes les colonnes du tableau
 * @param {Object} props.visibleColumns - { [colKey]: boolean } (false = masquée)
 * @param {Function} props.onToggle - (colKey) => void
 * @param {Function} props.onShowAll - Affiche toutes les colonnes
 * @param {Function} props.onHideAll - Masque toutes les colonnes
 */
const THEMES = {
  emerald: {
    button:
      "inline-flex items-center gap-2 px-4 py-2.5 border border-emerald-200 rounded-xl text-sm text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 transition cursor-pointer shadow-sm",
    panel: "absolute top-full left-0 mt-1.5 z-[200] w-64 bg-white border border-emerald-100 rounded-xl shadow-2xl p-3 max-h-72 overflow-y-auto",
    title: "text-xs font-semibold text-emerald-700 uppercase",
    showAll: "p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer",
    row: "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-50 cursor-pointer text-sm text-gray-700",
    checkbox: "rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer",
  },
  cyan: {
    button:
      "inline-flex items-center gap-2 px-3 py-2 border border-cyan-200 rounded-xl text-sm text-cyan-800 bg-cyan-50/50 hover:bg-cyan-50 transition cursor-pointer shadow-sm",
    panel: "absolute top-full right-0 mt-1.5 z-[200] w-64 bg-white border border-cyan-100 rounded-xl shadow-2xl p-3 max-h-72 overflow-y-auto",
    title: "text-xs font-semibold text-cyan-700 uppercase",
    showAll: "p-1.5 rounded-lg text-cyan-700 hover:bg-cyan-50 transition cursor-pointer",
    row: "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cyan-50 cursor-pointer text-sm text-gray-700",
    checkbox: "rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer",
  },
};

export default function DocumentColumnVisibilityMenu({
  allColumns = [],
  visibleColumns = {},
  onToggle,
  onShowAll,
  onHideAll,
  theme = "emerald",
}) {
  const styles = THEMES[theme] || THEMES.emerald;
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);

  /** Fermeture du menu au clic extérieur. */
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={anchorRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={styles.button}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10"
          />
        </svg>
        Colonnes visibles
      </button>

      {open && (
        <div className={styles.panel}>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className={styles.title}>Afficher</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onShowAll}
                title="Tout cocher"
                className={styles.showAll}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={onHideAll}
                title="Tout décocher"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </button>
            </div>
          </div>
          {allColumns.map((col) => (
            <label
              key={col.key}
              className={styles.row}
            >
              <input
                type="checkbox"
                checked={visibleColumns[col.key] !== false}
                onChange={() => onToggle(col.key)}
                className={styles.checkbox}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
