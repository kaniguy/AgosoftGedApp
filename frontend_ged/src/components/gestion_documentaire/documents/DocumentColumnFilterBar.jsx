/**
 * Barre de filtre personnalisé par colonne (style Odoo).
 *
 * Rôle : bouton unique « Filtre par colonne » sous la zone de recherche ;
 * panneau ancré au bouton (colonne → condition → valeur) ; pastilles des filtres actifs.
 * Utilisé par DocumentListeGlobale et DocumentListePanel.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyColumnFilter,
  formatColumnFilterSummary,
  getColumnFilterFamily,
  getOperatorsForFamily,
  hasColumnFilterValues,
  isColumnFilterActive,
} from "../../../utils/documentColumnFilters";

/** Options du filtre sur la colonne Format (extension fichier). */
const FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
];

const FIELD_CLASS =
  "w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
const LABEL_CLASS = "block text-xs text-gray-600 mb-1";

/** Liste déroulante pour colonnes format / select / choix, sinon null (champ texte libre). */
function getSelectOptions(column) {
  if (!column) return null;
  if (column.key === "format") return FORMAT_OPTIONS;
  if (column.key?.startsWith("champ_") && (column.typeChamp === "select" || column.typeChamp === "choix")) {
    return (column.options || []).map((opt) => ({ value: opt.valeur, label: opt.valeur }));
  }
  return null;
}

/** Type HTML de l'input valeur selon la famille (datetime-local pour date et datetime). */
function inputTypeForFamily(family, column) {
  if (family === "date" || column?.typeChamp === "date" || column?.typeChamp === "datetime") {
    return "datetime-local";
  }
  if (family === "number") return "number";
  return "text";
}

/**
 * @param {Object} props
 * @param {Array} props.columns - Colonnes filtrables (fixes + champs dynamiques)
 * @param {Object} props.columnFilters - Filtres appliqués { [colKey]: { op, value, valueTo? } }
 * @param {Function} props.onApply - (columnKey, filter|null) => void
 */
export default function DocumentColumnFilterBar({ columns = [], columnFilters = {}, onApply }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [columnKey, setColumnKey] = useState("");
  const [draft, setDraft] = useState(emptyColumnFilter());

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [columns]
  );

  const selectedColumn = sortedColumns.find((c) => c.key === columnKey) || sortedColumns[0] || null;
  const family = getColumnFilterFamily(selectedColumn);
  const operators = getOperatorsForFamily(family);
  const selectOptions = getSelectOptions(selectedColumn);
  const showBetween = draft.op === "between";
  const inputType = inputTypeForFamily(family, selectedColumn);
  const useSelect = selectOptions?.length > 0 && (family === "selection" || selectedColumn?.key === "format");
  const hasActive = hasColumnFilterValues(columnFilters);

  /** Filtres actifs avec métadonnées colonne pour l'affichage des pastilles. */
  const activeEntries = useMemo(
    () =>
      Object.entries(columnFilters)
        .filter(([, filter]) => isColumnFilterActive(filter))
        .map(([key, filter]) => ({
          key,
          filter,
          column: columns.find((c) => c.key === key),
        }))
        .filter((e) => e.column),
    [columnFilters, columns]
  );

  /** Fermeture du panneau au clic extérieur. */
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  /** Ouvre le panneau et initialise le brouillon (filtre existant ou vide). */
  const openMenu = () => {
    const first = sortedColumns[0];
    const initialKey = first?.key || "";
    setColumnKey(initialKey);
    const col = sortedColumns.find((c) => c.key === initialKey);
    const colFamily = getColumnFilterFamily(col);
    const existing = columnFilters[initialKey];
    setDraft(existing && isColumnFilterActive(existing) ? { ...existing } : emptyColumnFilter(colFamily));
    setOpen(true);
  };

  /** Change la colonne ciblée et réinitialise opérateur/valeurs si besoin. */
  const handleColumnChange = (key) => {
    setColumnKey(key);
    const col = sortedColumns.find((c) => c.key === key);
    const colFamily = getColumnFilterFamily(col);
    const validOps = getOperatorsForFamily(colFamily).map((o) => o.id);
    const existing = columnFilters[key];
    let next =
      existing && isColumnFilterActive(existing)
        ? { ...existing }
        : emptyColumnFilter(colFamily);
    if (!validOps.includes(next.op)) {
      next = { ...emptyColumnFilter(colFamily), value: "", valueTo: "" };
    }
    setDraft(next);
  };

  /** Met à jour l'opérateur ; efface valueTo si on quitte « Entre ». */
  const handleOpChange = (op) => {
    setDraft((prev) => ({ ...prev, op, valueTo: op === "between" ? prev.valueTo : "" }));
  };

  /** Valide et transmet le filtre au parent, puis ferme le panneau. */
  const apply = () => {
    if (!selectedColumn) return;
    if (!String(draft.value ?? "").trim()) return;
    if (draft.op === "between" && !String(draft.valueTo ?? "").trim()) return;
    onApply(selectedColumn.key, {
      ...draft,
      value: String(draft.value).trim(),
      valueTo: String(draft.valueTo ?? "").trim(),
    });
    setOpen(false);
  };

  /** Supprime un filtre via le parent (filter = null). */
  const removeFilter = (key) => {
    onApply(key, null);
  };

  if (sortedColumns.length === 0) return null;

  const valueField = useSelect ? (
    <select
      value={draft.value}
      onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))}
      className={FIELD_CLASS}
    >
      <option value="">—</option>
      {selectOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ) : (
    <input
      type={inputType}
      value={draft.value}
      onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))}
      className={FIELD_CLASS}
      placeholder="Valeur…"
    />
  );

  return (
    <div className="space-y-2">
      <div ref={anchorRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition cursor-pointer shadow-sm ${
            hasActive
              ? "border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filtre par colonne
          {hasActive && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold">
              {activeEntries.length}
            </span>
          )}
        </button>

        {open && (
          <div
            className="absolute top-full left-0 mt-1.5 z-[200] w-[min(100vw-2rem,42rem)] bg-white border border-emerald-200 rounded-xl shadow-2xl p-4 text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-3">
              Filtre personnalisé
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={LABEL_CLASS}>Colonne</label>
                <select
                  value={columnKey || selectedColumn?.key || ""}
                  onChange={(e) => handleColumnChange(e.target.value)}
                  className={FIELD_CLASS}
                >
                  {sortedColumns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Condition</label>
                <select
                  value={draft.op}
                  onChange={(e) => handleOpChange(e.target.value)}
                  className={FIELD_CLASS}
                >
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>{showBetween ? "De" : "Valeur"}</label>
                {valueField}
              </div>
            </div>

            {showBetween && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="hidden sm:block" aria-hidden="true" />
                <div className="hidden sm:block" aria-hidden="true" />
                <div>
                  <label className={LABEL_CLASS}>À</label>
                  <input
                    type={inputType}
                    value={draft.valueTo}
                    onChange={(e) => setDraft((p) => ({ ...p, valueTo: e.target.value }))}
                    className={FIELD_CLASS}
                    placeholder="Valeur…"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={apply}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}
      </div>

      {activeEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeEntries.map(({ key, filter, column }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 max-w-full px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900"
              title={`${column.label} : ${formatColumnFilterSummary(column, filter)}`}
            >
              <span className="font-semibold truncate">{column.label}</span>
              <span className="text-emerald-600 truncate">{formatColumnFilterSummary(column, filter)}</span>
              <button
                type="button"
                onClick={() => removeFilter(key)}
                className="shrink-0 p-0.5 rounded hover:bg-emerald-200/80 text-emerald-700"
                title="Retirer ce filtre"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
