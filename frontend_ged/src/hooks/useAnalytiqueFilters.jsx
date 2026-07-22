"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_FILTERS = {
  periode: "365",
  statut: "",
  type_document: "",
  localite: "",
};

const AnalytiqueFiltersContext = createContext(null);

export function AnalytiqueFiltersProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => ({
    periode: searchParams.get("periode") || DEFAULT_FILTERS.periode,
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
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [filters, pathname, router]
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
    router.push(pathname);
  }, [pathname, router]);

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
