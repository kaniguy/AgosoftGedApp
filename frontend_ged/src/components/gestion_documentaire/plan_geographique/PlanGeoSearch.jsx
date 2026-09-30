"use client";

import { useEffect, useRef, useState } from "react";
import { rechercherPlansGeographiques } from "../../../services/planGeographique.service";

const THEMES = {
  emerald: {
    input:
      "border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500",
  },
  teal: {
    input: "border-teal-200 focus:ring-teal-500 focus:border-teal-500",
  },
  fuchsia: {
    input: "border-fuchsia-200 focus:ring-fuchsia-500 focus:border-fuchsia-500",
  },
  yellow: {
    input: "border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500",
  },
};

export default function PlanGeoSearch({
  onSelect,
  onClear,
  filterAccess = false,
  theme = "emerald",
  clearQueryOnSelect = true,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await rechercherPlansGeographiques(query.trim(), filterAccess);
        setResults(Array.isArray(data?.results) ? data.results : []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filterAccess]);

  const themeClasses = THEMES[theme] || THEMES.emerald;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result) => {
    if (clearQueryOnSelect) {
      setQuery("");
    }
    setResults([]);
    setOpen(false);
    onSelect(result);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onClear?.();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={`w-full px-4 py-2.5 pl-10 pr-10 text-gray-700 bg-white border rounded-xl focus:outline-none focus:ring-2 text-sm shadow-sm ${themeClasses.input}`}
          placeholder="Rechercher un site..."
          autoComplete="off"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-[200] left-0 mt-2 min-w-full w-max max-w-[min(100*var(--app-vw)-2rem,52rem)] bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-96 overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-500 text-center whitespace-nowrap">Recherche...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center whitespace-nowrap">Aucun résultat trouvé</div>
          ) : (
            <div className="py-2 min-w-max">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition"
                >
                  <div className="font-semibold text-gray-900 whitespace-nowrap">{result.libelle}</div>
                  {result.niveau && (
                    <div className="text-sm text-gray-600 mt-0.5 whitespace-nowrap">{result.niveau}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="whitespace-nowrap">{result.chemin_str}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
