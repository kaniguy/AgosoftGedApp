"use client";

import { useCallback, useEffect, useState } from "react";
import { getAnalyticsDocumentsGeo } from "../../services/analytique.service";
import { useAnalytiqueFilters } from "../../hooks/useAnalytiqueFilters";
import { ChartEmpty } from "./AnalytiqueShared";

function CountBar({ count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-2 bg-orange-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-bold tabular-nums text-orange-700 w-8 text-right">{count}</span>
    </div>
  );
}

export default function DocumentsGeoExplorer() {
  const { filters, toggleFilter, setFilter } = useAnalytiqueFilters();
  const [geoParent, setGeoParent] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGeo = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAnalyticsDocumentsGeo(filters, geoParent);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, geoParent]);

  useEffect(() => {
    loadGeo();
  }, [loadGeo]);

  const handleRowClick = (item) => {
    if (item.has_children) {
      if (filters.localite) setFilter("localite", "");
      setGeoParent(String(item.localite_id));
      return;
    }
    toggleFilter("localite", String(item.localite_id));
  };

  const goToRoot = () => {
    setGeoParent("");
    if (filters.localite) setFilter("localite", "");
  };

  const goToParent = () => {
    if (data?.parent_id != null) {
      setGeoParent(String(data.parent_id));
    } else {
      setGeoParent("");
    }
    if (filters.localite) setFilter("localite", "");
  };

  const goToBreadcrumb = (id) => {
    setGeoParent(String(id));
    if (filters.localite) setFilter("localite", "");
  };

  const items = data?.items ?? [];
  const maxCount = Math.max(...items.map((i) => i.count), 1);
  const totalCount = items.reduce((sum, i) => sum + i.count, 0);
  const filteredItem = items.find(
    (i) => !i.has_children && filters.localite === String(i.localite_id)
  );

  return (
    <div>
      <nav className="flex flex-wrap items-center gap-1 text-sm mb-3">
        <button
          type="button"
          onClick={goToRoot}
          className={`px-2 py-1 rounded-md font-medium transition-colors ${
            !geoParent ? "bg-orange-100 text-orange-800" : "text-orange-700 hover:bg-orange-50"
          }`}
        >
          Racine
        </button>
        {(data?.breadcrumb ?? []).map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            {index === (data?.breadcrumb?.length ?? 0) - 1 ? (
              <span className="font-semibold text-slate-800 px-1">{crumb.libelle}</span>
            ) : (
              <button
                type="button"
                onClick={() => goToBreadcrumb(crumb.id)}
                className="text-orange-700 hover:underline px-1"
              >
                {crumb.libelle}
              </button>
            )}
          </span>
        ))}
        {data?.parent_id != null && (
          <button
            type="button"
            onClick={goToParent}
            className="ml-auto text-xs text-slate-500 hover:text-orange-700 px-2 py-1 rounded hover:bg-slate-50"
          >
            ↑ Remonter
          </button>
        )}
      </nav>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
          Niveau : {data?.niveau_label || "—"}
        </span>
        {filteredItem && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
            Zone filtrée : {filteredItem.libelle}
            <button
              type="button"
              onClick={() => setFilter("localite", "")}
              className="hover:text-orange-950 ml-1"
              aria-label="Retirer le filtre zone"
            >
              ×
            </button>
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Cliquez sur une ligne avec « Explorer » pour descendre dans la hiérarchie.
        Sur une localité finale, cliquez pour filtrer le dashboard sur cette zone.
      </p>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <ChartEmpty title="Aucune entité géographique à ce niveau" />
      ) : (
        <div className="overflow-auto max-h-80 border border-slate-100 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Libellé</th>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Niveau</th>
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Documents</th>
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600 w-20">Taux</th>
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isFiltered =
                  !item.has_children && filters.localite === String(item.localite_id);
                const taux =
                  totalCount > 0 ? Math.round((item.count / totalCount) * 1000) / 10 : 0;
                return (
                  <tr
                    key={item.localite_id}
                    onClick={() => handleRowClick(item)}
                    className={`
                      border-t border-slate-50 cursor-pointer transition-colors
                      ${isFiltered ? "bg-orange-50" : "hover:bg-orange-50/60"}
                    `}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{item.libelle}</td>
                    <td className="px-4 py-3 text-slate-500">{item.niveau}</td>
                    <td className="px-4 py-3">
                      <CountBar count={item.count} max={maxCount} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-600">
                      {taux} %
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-1 rounded-md ${
                          item.has_children
                            ? "bg-orange-100 text-orange-700"
                            : isFiltered
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.has_children ? "Explorer →" : isFiltered ? "Actif ✓" : "Filtrer"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
