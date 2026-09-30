"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const DEFAULT_FILTERS = {
  periode: "365",
  date_debut: "",
  date_fin: "",
  statut: "",
  type_document: "",
  localite: "",
};

/** Bornes de la période personnalisée : comptées avec le filtre « periode », pas séparément. */
const PERIOD_BOUND_KEYS = new Set(["date_debut", "date_fin"]);

const AnalytiqueFiltersContext = createContext(null);

/**
 * Mise à jour de l'URL par l'API History (synchronisée avec useSearchParams par Next.js).
 * router.push/replace vers la même page sans paramètres restaure les anciens paramètres
 * depuis le cache du routeur en Next 16.2.x : le bouton « Réinitialiser » restait sans effet.
 */
function navigateInPlace(url, replace) {
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

export function AnalytiqueFiltersProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => ({
    periode: searchParams.get("periode") || DEFAULT_FILTERS.periode,
    date_debut: searchParams.get("date_debut") || "",
    date_fin: searchParams.get("date_fin") || "",
    statut: searchParams.get("statut") || "",
    type_document: searchParams.get("type_document") || "",
    localite: searchParams.get("localite") || "",
  }), [searchParams]);

  const setFilters = useCallback(
    (updates, { replace = true } = {}) => {
      const next = { ...filters, ...updates };
      const params = new URLSearchParams();
      Object.entries(next).forEach(([key, value]) => {
        const defaultVal = DEFAULT_FILTERS[key];
        if (value && value !== defaultVal) {
          params.set(key, value);
        }
      });
      const qs = params.toString();
      navigateInPlace(qs ? `${pathname}?${qs}` : pathname, replace);
    },
    [filters, pathname]
  );

  const setFilter = useCallback(
    (key, value) => setFilters({ [key]: value || "" }),
    [setFilters]
  );

  const toggleFilter = useCallback(
    (key, value) => {
      const current = filters[key];
      setFilter(key, current === value ? "" : value);
    },
    [filters, setFilter]
  );

  const resetFilters = useCallback(() => {
    navigateInPlace(pathname, false);
  }, [pathname]);

  const buildUrl = useCallback(
    (targetPath, extra = {}) => {
      const merged = { ...filters, ...extra };
      const params = new URLSearchParams();
      Object.entries(merged).forEach(([key, value]) => {
        const defaultVal = DEFAULT_FILTERS[key];
        if (value && value !== defaultVal) {
          params.set(key, value);
        }
      });
      const qs = params.toString();
      return qs ? `${targetPath}?${qs}` : targetPath;
    },
    [filters]
  );

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (PERIOD_BOUND_KEYS.has(key)) return false;
        if (key === "periode") return value && value !== DEFAULT_FILTERS.periode;
        return Boolean(value);
      }).length,
    [filters]
  );

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      setFilter,
      toggleFilter,
      resetFilters,
      buildUrl,
      activeFilterCount,
    }),
    [filters, setFilters, setFilter, toggleFilter, resetFilters, buildUrl, activeFilterCount]
  );

  return (
    <AnalytiqueFiltersContext.Provider value={value}>
      {children}
    </AnalytiqueFiltersContext.Provider>
  );
}

export function useAnalytiqueFilters() {
  const ctx = useContext(AnalytiqueFiltersContext);
  if (!ctx) {
    throw new Error("useAnalytiqueFilters must be used within AnalytiqueFiltersProvider");
  }
  return ctx;
}
