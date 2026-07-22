"use client";

import { useEffect, useState } from "react";
import { getAnalyticsMeta } from "../../services/analytique.service";
import { useAnalytiqueFilters } from "../../hooks/useAnalytiqueFilters";

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
      {label}
      <button type="button" onClick={onRemove} className="hover:text-orange-950" aria-label="Retirer le filtre">
        ×
      </button>
    </span>
  );
}

export default function AnalytiqueFiltersBar({ showStatut = true, showType = true, showLocalite = false }) {
  const { filters, setFilter, resetFilters, activeFilterCount } = useAnalytiqueFilters();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    getAnalyticsMeta()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const statutLabel = meta?.statuts?.find((s) => s.value === filters.statut)?.label;
  const typeLabel = meta?.types_documents?.find(
    (t) => String(t.id) === filters.type_document
  )?.libelle;
  const localiteLabel = meta?.localites?.find(
    (l) => String(l.id) === filters.localite
  )?.libelle;
  const periodeLabel = meta?.periodes?.find((p) => p.value === filters.periode)?.label;

  return (
    <div className="mb-6 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-slate-500">Période</label>
          <select
            value={filters.periode}
            onChange={(e) => setFilter("periode", e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            {(meta?.periodes ?? [{ value: "365", label: "12 derniers mois" }]).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {showStatut && (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-slate-500">Statut QC</label>
            <select
              value={filters.statut}
              onChange={(e) => setFilter("statut", e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              {(meta?.statuts ?? []).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showType && (
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-medium text-slate-500">Type de document</label>
            <select
              value={filters.type_document}
              onChange={(e) => setFilter("type_document", e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">Tous les types</option>
              {(meta?.types_documents ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </div>
        )}

        {showLocalite && (
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-medium text-slate-500">Localité</label>
            <select
              value={filters.localite}
              onChange={(e) => setFilter("localite", e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">Toutes les localités</option>
              {(meta?.localites ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.libelle} ({l.doc_count})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-slate-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
          >
            Réinitialiser ({activeFilterCount})
          </button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          {filters.periode !== "365" && periodeLabel && (
            <FilterChip label={periodeLabel} onRemove={() => setFilter("periode", "365")} />
          )}
          {filters.statut && statutLabel && (
            <FilterChip label={statutLabel} onRemove={() => setFilter("statut", "")} />
          )}
          {filters.type_document && typeLabel && (
            <FilterChip label={typeLabel} onRemove={() => setFilter("type_document", "")} />
          )}
          {filters.localite && localiteLabel && (
            <FilterChip label={localiteLabel} onRemove={() => setFilter("localite", "")} />
          )}
        </div>
      )}
    </div>
  );
}
