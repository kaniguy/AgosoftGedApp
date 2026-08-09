// Liste des documents d'un site (localité) : filtres, filtre par colonne, colonnes visibles, tableau, aperçu et actions CRUD.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getChampsDocuments } from "../../../services/champsDocument.service";
import { getStructuresGeographiques } from "../../../services/structureGeo.service";
import {
  getDocuments,
  getTypesAvecDocuments,
  deleteDocumentLocalite,
  downloadDocumentLocalite,
  DOCUMENT_PAGE_SIZE,
  hasColumnFilterValues,
} from "../../../services/documentLocalite.service";
import { STATUT_VALIDE } from "../../../utils/documentStatutQualite";
import DocumentListSplitView from "./DocumentListSplitView";
import DocumentTableHead from "./DocumentTableHead";
import DocumentColumnFilterBar from "./DocumentColumnFilterBar";
import DocumentColumnVisibilityMenu from "./DocumentColumnVisibilityMenu";
import { clearChampColumnFilters } from "../../../utils/documentColumnFilters";
import {
  buildDocumentTableBaseColumns,
  getCheminEntry,
  getLeafLocaliteLabel,
} from "../../../utils/documentGeoColumns";
import { formatDisplayDateTime, getRegistrationDateFromDocument, isRegistrationDateChamp } from "../../../utils/dateFormat";
import { getFileFormat } from "../../../utils/documentFileFormat";
import ChampCellValue from "./ChampCellValue";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";

const FORMAT_OPTIONS = [
  { value: "", label: "Tous les formats" },
  { value: "pdf", label: "PDF" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
];

const EMPTY_FILTERS = {
  search: "",
  typeDocumentId: "",
  format: "",
  dateDebut: "",
  dateFin: "",
  champFilters: {},
  columnFilters: {},
};

const TH_CELL = "px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap border-r border-emerald-500/40 last:border-r-0";
const TD_CELL = "px-4 py-3.5 text-gray-700 align-middle max-w-xs border-r border-emerald-100 last:border-r-0";

const FORMAT_STYLES = {
  PDF: "bg-rose-50 text-rose-700 border-rose-200",
  JPEG: "bg-sky-50 text-sky-700 border-sky-200",
  PNG: "bg-indigo-50 text-indigo-700 border-indigo-200",
  WEBP: "bg-violet-50 text-violet-700 border-violet-200",
  GIF: "bg-pink-50 text-pink-700 border-pink-200",
};

function formatDate(value) {
  return formatDisplayDateTime(value);
}

function buildChampColumns(champs) {
  return (champs || [])
    .filter((c) => !isRegistrationDateChamp(c))
    .map((c) => ({
    key: `champ_${c.id}`,
    champId: c.id,
    typeChamp: c.type_champ,
    label: c.libelle_champ || `Champ ${c.id}`,
    options: c.options || [],
  }));
}

function getFormatStyle(format) {
  return FORMAT_STYLES[format] || "bg-slate-50 text-slate-700 border-slate-200";
}

function getChampRawValue(doc, champId) {
  const found = (doc.valeurs || []).find((v) => v.champ_id === champId);
  return found?.valeur;
}

async function handleDownload(doc, getFilename, onNotify, previewSource) {
  if (!doc?.fichier_url && !previewSource?.previewUrl) return;
  try {
    if (previewSource?.downloadMode === "archived" && previewSource.archivedVersionId) {
      await downloadDocumentLocalite(doc, getFilename(doc), {
        versionId: previewSource.archivedVersionId,
      });
    } else {
      await downloadDocumentLocalite(doc, getFilename(doc));
    }
  } catch (err) {
    onNotify?.(err.message || "Téléchargement impossible", "error");
  }
}

function ActionButton({ onClick, disabled, variant, title, children }) {
  const variants = {
    view: "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400",
    download: "border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400",
    edit: "border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:border-amber-400",
    delete: "border-red-300 text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export default function DocumentListePanel({ localite, onClose, onAttach, onNotify }) {
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.DOCUMENT_LOCALITE);
  const router = useRouter();
  const tableScrollRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [typesAvecDocuments, setTypesAvecDocuments] = useState([]);
  const [champsColumns, setChampsColumns] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [typesReady, setTypesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const baseColumns = useMemo(
    () =>
      buildDocumentTableBaseColumns(structures, {
        includeType: !appliedFilters.typeDocumentId,
      }),
    [structures, appliedFilters.typeDocumentId]
  );

  const allColumns = useMemo(
    () => [...baseColumns, ...champsColumns],
    [baseColumns, champsColumns]
  );

  const notifyUser = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const buildDocumentQuery = useCallback(
    (activeFilters, offset = 0) => ({
      localiteId: localite?.id,
      typeDocumentId: activeFilters.typeDocumentId || undefined,
      q: activeFilters.search || undefined,
      dateDebut: activeFilters.dateDebut || undefined,
      dateFin: activeFilters.dateFin || undefined,
      format: activeFilters.format || undefined,
      statutQualite: STATUT_VALIDE,
      champFilters: activeFilters.champFilters,
      columnFilters: activeFilters.columnFilters,
      offset,
      limit: DOCUMENT_PAGE_SIZE,
    }),
    [localite?.id]
  );

  const loadDocuments = useCallback(
    async (offset = 0, activeFilters = appliedFilters) => {
      if (!localite?.id) {
        setDocuments([]);
        setTotal(0);
        setHasMore(false);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const query = buildDocumentQuery(activeFilters, offset);
        const res = await getDocuments(query);
        setDocuments(res.results);
        setTotal(res.total);
        setHasMore(res.has_more);
        setPageOffset(res.offset);
      } catch (err) {
        notifyUser(err.message || "Erreur chargement documents", "error");
        setDocuments([]);
        setTotal(0);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [localite?.id, appliedFilters, notifyUser, buildDocumentQuery]
  );

  const initTypes = useCallback(async () => {
    if (!localite?.id) return;
    try {
      setTypesReady(false);
      setFilters(EMPTY_FILTERS);
      setAppliedFilters(EMPTY_FILTERS);
      const types = await getTypesAvecDocuments(localite.id, { statutQualite: STATUT_VALIDE });
      setTypesAvecDocuments(types);
    } catch (err) {
      notifyUser(err.message || "Erreur chargement types", "error");
      setTypesAvecDocuments([]);
    } finally {
      setTypesReady(true);
    }
  }, [localite?.id, notifyUser]);

  const loadChampsForType = useCallback(async (typeId) => {
    if (!typeId) {
      setChampsColumns([]);
      return;
    }
    try {
      const data = await getChampsDocuments(typeId);
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.ordre - b.ordre) : [];
      setChampsColumns(buildChampColumns(sorted));
    } catch {
      setChampsColumns([]);
    }
  }, []);

  useEffect(() => {
    initTypes();
  }, [initTypes]);

  useEffect(() => {
    getStructuresGeographiques()
      .then((data) => setStructures(Array.isArray(data) ? data : []))
      .catch(() => setStructures([]));
  }, []);

  useEffect(() => {
    if (!typesReady || !localite?.id) return;
    setPageOffset(0);
    loadDocuments(0, EMPTY_FILTERS);
  }, [typesReady, localite?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadChampsForType(appliedFilters.typeDocumentId);
  }, [appliedFilters.typeDocumentId, loadChampsForType]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setAppliedFilters((prev) => {
        if (prev.search === filters.search) return prev;
        const next = { ...prev, search: filters.search };
        setPageOffset(0);
        loadDocuments(0, next);
        return next;
      });
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [filters.search, loadDocuments]);

  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allColumns.forEach((col) => {
        if (next[col.key] === undefined) next[col.key] = true;
      });
      return next;
    });
  }, [allColumns]);

  const activeColumns = allColumns.filter((col) => visibleColumns[col.key] !== false);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applySelectFilters = (key, value) => {
    const next = {
      ...filters,
      [key]: value,
      ...(key === "typeDocumentId"
        ? { champFilters: {}, columnFilters: clearChampColumnFilters(filters.columnFilters) }
        : {}),
    };
    setFilters(next);
    setAppliedFilters(next);
    setPageOffset(0);
    loadDocuments(0, next);
  };

  const handleColumnFilterApply = (columnKey, filter) => {
    const columnFilters = { ...filters.columnFilters };
    if (filter) columnFilters[columnKey] = filter;
    else delete columnFilters[columnKey];
    const next = { ...filters, columnFilters };
    setFilters(next);
    setAppliedFilters(next);
    setPageOffset(0);
    loadDocuments(0, next);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPageOffset(0);
    loadDocuments(0, EMPTY_FILTERS);
  };

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showAllColumns = () => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allColumns.forEach((col) => {
        next[col.key] = true;
      });
      return next;
    });
  };

  const hideAllColumns = () => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allColumns.forEach((col) => {
        next[col.key] = false;
      });
      return next;
    });
  };

  const getFilename = (doc) => {
    const base = doc.type_document_libelle || "document";
    const url = doc.fichier_url || "";
    const ext = url.split("?")[0].split(".").pop() || "";
    return ext ? `${base}.${ext}` : base;
  };

  const goToEdit = (doc) => {
    router.push(
      `/gestion_documentaire/plan_geographique/${localite.id}/documents/${doc.id}/modifier`
    );
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) return;
    try {
      setDeleting(true);
      await deleteDocumentLocalite(deleteDoc.id);
      if (previewDoc?.id === deleteDoc.id) setPreviewDoc(null);
      setDeleteDoc(null);
      const nextOffset =
        documents.length <= 1 && pageOffset > 0
          ? Math.max(0, pageOffset - DOCUMENT_PAGE_SIZE)
          : pageOffset;
      await loadDocuments(nextOffset);
      notifyUser("Document supprimé avec succès", "success");
    } catch (err) {
      notifyUser(err.message || "Erreur lors de la suppression", "error");
    } finally {
      setDeleting(false);
    }
  };

  const currentPage = Math.floor(pageOffset / DOCUMENT_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / DOCUMENT_PAGE_SIZE));
  const selectedTypeInfo = typesAvecDocuments.find(
    (t) => String(t.id) === String(appliedFilters.typeDocumentId)
  );

  const hasActiveFilters =
    Boolean(appliedFilters.search) ||
    Boolean(appliedFilters.typeDocumentId) ||
    Boolean(appliedFilters.format) ||
    Boolean(appliedFilters.dateDebut) ||
    Boolean(appliedFilters.dateFin) ||
    hasColumnFilterValues(appliedFilters.columnFilters);

  const goToPrevPage = () => {
    if (pageOffset <= 0) return;
    loadDocuments(Math.max(0, pageOffset - DOCUMENT_PAGE_SIZE));
  };

  const goToNextPage = () => {
    if (!hasMore) return;
    loadDocuments(pageOffset + DOCUMENT_PAGE_SIZE);
  };

  if (!localite) return null;

  return (
    <div className="rounded-2xl shadow-xl border border-emerald-100/80 overflow-hidden flex flex-col min-h-[calc(100vh-10rem)] max-w-full min-w-0 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 relative">
      {toast && (
        <div className="fixed top-20 right-5 z-[100000] animate-fade-in">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-xl shadow-xl text-white flex items-center gap-3 ${
              toast.type === "error"
                ? "bg-gradient-to-r from-red-500 to-rose-600"
                : "bg-gradient-to-r from-emerald-500 to-teal-600"
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      {/* En-tête */}
      <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white shrink-0 overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-24 bottom-0 w-24 h-24 rounded-full bg-teal-400/20" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-medium mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Gestion documentaire
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Documents du site</h3>
            <p className="text-emerald-100 mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-md bg-white/20 text-sm font-semibold">
                {localite.niveau_libelle}
              </span>
              <span className="text-white font-medium">{localite.libelle}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canAdd && (
            <button
              type="button"
              onClick={onAttach}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Rattacher un document
            </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition cursor-pointer"
              title="Retour au plan géographique"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 flex-1 min-h-0 min-w-0 flex flex-col">
        {/* Barre filtres */}
        <div className="shrink-0 bg-white/90 backdrop-blur rounded-2xl border border-emerald-100 shadow-sm p-4 sm:p-5 relative z-30 space-y-4 overflow-visible">
          <div className="flex flex-wrap items-center gap-2 relative z-40">
            <DocumentColumnVisibilityMenu
              allColumns={allColumns}
              visibleColumns={visibleColumns}
              onToggle={toggleColumn}
              onShowAll={showAllColumns}
              onHideAll={hideAllColumns}
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Réinitialiser les filtres
              </button>
            )}

            {selectedTypeInfo && (
              <span className="text-sm text-emerald-700 font-medium">
                Filtre actif : {selectedTypeInfo.libelle}
              </span>
            )}

            <span className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-md">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {total} document{total !== 1 ? "s" : ""}
              {selectedTypeInfo ? ` · ${selectedTypeInfo.libelle}` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
            <div>
              <label htmlFor="filtre-recherche-site" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Recherche textuelle
              </label>
              <input
                id="filtre-recherche-site"
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Site, métadonnées…"
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="filtre-type-doc" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Type de document
              </label>
              <select
                id="filtre-type-doc"
                value={filters.typeDocumentId}
                onChange={(e) => applySelectFilters("typeDocumentId", e.target.value)}
                disabled={typesAvecDocuments.length === 0}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm disabled:bg-gray-100"
              >
                {typesAvecDocuments.length === 0 ? (
                  <option value="">Aucun type avec documents</option>
                ) : (
                  <>
                    <option value="">Tous les types</option>
                    {typesAvecDocuments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.libelle} ({t.code}) — {t.count} doc{t.count !== 1 ? "s" : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="filtre-format-site" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Format
              </label>
              <select
                id="filtre-format-site"
                value={filters.format}
                onChange={(e) => applySelectFilters("format", e.target.value)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtre-date-debut-site" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Période début
              </label>
              <input
                id="filtre-date-debut-site"
                type="date"
                value={filters.dateDebut}
                onChange={(e) => applySelectFilters("dateDebut", e.target.value)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="filtre-date-fin-site" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Période fin
              </label>
              <input
                id="filtre-date-fin-site"
                type="date"
                value={filters.dateFin}
                onChange={(e) => applySelectFilters("dateFin", e.target.value)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>
          </div>

          <DocumentColumnFilterBar
            columns={allColumns}
            columnFilters={appliedFilters.columnFilters}
            onApply={handleColumnFilterApply}
          />
        </div>

        {/* Tableau */}
        <DocumentListSplitView
          previewDoc={previewDoc}
          onClosePreview={() => setPreviewDoc(null)}
          onDownload={(doc, previewSource) => handleDownload(doc, getFilename, notifyUser, previewSource)}
          getFilename={getFilename}
        >
        <div
          ref={tableScrollRef}
          className={`flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto relative isolate ${
            previewDoc ? "h-full" : "rounded-2xl border border-emerald-100 bg-white shadow-sm"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                {typesAvecDocuments.length === 0
                  ? "Aucun document pour ce site"
                  : hasActiveFilters
                    ? "Aucun document ne correspond aux filtres"
                    : "Aucun document pour ce site"}
              </p>
              {canAdd && (
              <button
                type="button"
                onClick={onAttach}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition cursor-pointer shadow-md"
              >
                Rattacher un document
              </button>
              )}
            </div>
          ) : (
            <table className="min-w-full w-max text-sm border-collapse">
              <DocumentTableHead columns={activeColumns} thCellClass={TH_CELL} />
              <tbody>
                {documents.map((doc, index) => {
                  const format = getFileFormat(doc);
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-emerald-200 transition-colors hover:bg-emerald-50/70 ${
                        previewDoc?.id === doc.id
                          ? "bg-emerald-100/80 ring-1 ring-inset ring-emerald-300"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-emerald-50/20"
                      }`}
                    >
                      {activeColumns.map((col) => (
                        <td key={col.key} className={TD_CELL}>
                          {col.key.startsWith("geo_") && (
                            <span className="text-gray-800 font-medium">
                              {getCheminEntry(doc, col.niveauOrdre)?.libelle || "—"}
                            </span>
                          )}
                          {col.key === "localite" && (
                            <span className="text-emerald-800 font-medium">
                              {getLeafLocaliteLabel(doc)}
                            </span>
                          )}
                          {col.key === "type" && (
                            <span className="text-gray-800 font-medium">{doc.type_document_libelle || "—"}</span>
                          )}
                          {col.key === "format" && (
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${getFormatStyle(format)}`}
                            >
                              {format}
                            </span>
                          )}
                          {col.key === "date" && (
                            <span className="text-gray-600 whitespace-nowrap text-xs">
                              {formatDate(getRegistrationDateFromDocument(doc))}
                            </span>
                          )}
                          {col.key === "date_modification" && (
                            <span className="text-gray-600 whitespace-nowrap text-xs">
                              {formatDate(doc.date_modification || doc.date_creation)}
                            </span>
                          )}
                          {col.key.startsWith("champ_") && (
                            <ChampCellValue
                              value={getChampRawValue(doc, col.champId)}
                              typeChamp={col.typeChamp}
                            />
                          )}
                        </td>
                      ))}
                      <td className={`${TD_CELL} text-right border-r-0`}>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <ActionButton
                            variant="view"
                            title="Voir le document"
                            disabled={!doc.fichier_url}
                            onClick={() => setPreviewDoc((prev) => (prev?.id === doc.id ? null : doc))}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Voir
                          </ActionButton>
                          <ActionButton
                            variant="download"
                            title="Télécharger"
                            disabled={!doc.fichier_url}
                            onClick={() => handleDownload(doc, getFilename, notifyUser)}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Télécharger
                          </ActionButton>
                          {canChange && (
                          <ActionButton variant="edit" title="Modifier" onClick={() => goToEdit(doc)}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Modifier
                          </ActionButton>
                          )}
                          {canDelete && (
                          <ActionButton variant="delete" title="Supprimer" onClick={() => setDeleteDoc(doc)}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Supprimer
                          </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && total > 0 && totalPages > 1 && (
            <div className="sticky bottom-0 flex items-center justify-between gap-4 px-4 py-3 bg-white border-t border-emerald-200 text-sm">
              <span className="text-gray-600">
                Page {currentPage} / {totalPages} — {total} document{total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={pageOffset <= 0 || loading}
                  className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={!hasMore || loading}
                  className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
        </DocumentListSplitView>
      </div>

      {deleteDoc && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100">
            <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white">
              <h4 className="text-lg font-semibold">Supprimer le document</h4>
            </div>
            <div className="p-6">
              <p className="text-gray-700">
                Confirmez la suppression du document{" "}
                <strong className="text-gray-900">{deleteDoc.type_document_libelle}</strong>{" "}
                ({getFileFormat(deleteDoc)}) ?
              </p>
              <p className="text-sm text-red-600 mt-2">Cette action est irréversible.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteDoc(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-white transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-rose-700 disabled:opacity-50 transition cursor-pointer"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
