/**
 * En-têtes du tableau de liste des documents.
 *
 * Rôle : afficher les libellés des colonnes visibles (sans filtre intégré ;
 * les filtres par colonne passent par DocumentColumnFilterBar).
 */
"use client";

import { useEffect, useRef } from "react";

function SelectAllCheckbox({ checked, indeterminate, disabled, onChange, title }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate, checked]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="rounded border-white/30 text-emerald-600 focus:ring-emerald-400 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      title={title}
    />
  );
}

/**
 * @param {Object} props
 * @param {Array<{ key: string, label: string }>} props.columns - Colonnes affichées
 * @param {string} props.thCellClass - Classes CSS des cellules d'en-tête
 * @param {string} [props.actionsLabel] - Libellé de la colonne Actions
 * @param {{ allSelected: boolean, indeterminate?: boolean, disabled?: boolean, title?: string, onToggleAll: () => void }} [props.selection] - Colonne de sélection multiple
 */
export default function DocumentTableHead({ columns, thCellClass, actionsLabel = "Actions", selection }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white">
        {selection && (
          <th className={`${thCellClass} w-12 text-center`}>
            <SelectAllCheckbox
              checked={selection.allSelected}
              indeterminate={selection.indeterminate}
              disabled={selection.disabled}
              onChange={selection.onToggleAll}
              title={selection.title || "Tout sélectionner"}
            />
          </th>
        )}
        {columns.map((col) => (
          <th key={col.key} className={thCellClass}>
            <span className="truncate">{col.label}</span>
          </th>
        ))}
        <th className={`${thCellClass} text-right`}>{actionsLabel}</th>
      </tr>
    </thead>
  );
}
