// Liste globale de tous les documents : filtres multi-critères, filtre par colonne (DocumentColumnFilterBar),
// visibilité des colonnes (DocumentColumnVisibilityMenu), tableau et aperçu.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getChampsDocuments } from "../../../services/champsDocument.service";
import { getStructuresGeographiques } from "../../../services/structureGeo.service";
import {
  getDocuments,
  getAllMatchingDocumentIds,
  getTypesAvecDocuments,
  deleteDocumentLocalite,
  deleteDocumentsLocalite,
  downloadDocumentLocalite,
  DOCUMENT_PAGE_SIZE,
  hasColumnFilterValues,
} from "../../../services/documentLocalite.service";
import PlanGeoSearch from "../plan_geographique/PlanGeoSearch";
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
import { STATUT_VALIDE } from "../../../utils/documentStatutQualite";

const FORMAT_OPTIONS = [
  { value: "", label: "Tous les formats" },
  { value: "pdf", label: "PDF" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
];

const TH_CELL =
  "px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap border-r border-emerald-500/40 last:border-r-0";
const TD_CELL =
  "px-4 py-3.5 text-gray-700 align-middle max-w-xs border-r border-emerald-100 last:border-r-0";

const FORMAT_STYLES = {
  PDF: "bg-rose-50 text-rose-700 border-rose-200",
  JPEG: "bg-sky-50 text-sky-700 border-sky-200",
  PNG: "bg-indigo-50 text-indigo-700 border-indigo-200",
  WEBP: "bg-violet-50 text-violet-700 border-violet-200",
  GIF: "bg-pink-50 text-pink-700 border-pink-200",
};

const EMPTY_FILTERS = {
  search: "",
  typeDocumentId: "",
  format: "",
  dateDebut: "",
  dateFin: "",
  champFilters: {},
  columnFilters: {},
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

export default function DocumentListeGlobale({ onNotify }) {
  const { canChange, canDelete } = useCrudPermissions(MODELS.DOCUMENT_LOCALITE);
  const router = useRouter();
  const tableScrollRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [typesAvecDocuments, setTypesAvecDocuments] = useState([]);
  const [champsColumns, setChampsColumns] = useState([]);
  const [selectedLocalite, setSelectedLocalite] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const baseColumns = useMemo(
    () => buildDocumentTableBaseColumns(structures, { includeType: true }),
    [structures]
  );

  const allColumns = useMemo(() => [...baseColumns, ...champsColumns], [baseColumns, champsColumns]);

  const notifyUser = useCallback(
    (message, type = "success") => {
      if (onNotify) {
        onNotify(message, type);
        return;
      }
      setToast({ message, type });
      setTimeout(() => setToast(null), 5000);
    },
    [onNotify]
  );

  const loadTypes = useCallback(async (localiteId = null) => {
    try {
      const types = await getTypesAvecDocuments(localiteId, { statutQualite: STATUT_VALIDE });
      setTypesAvecDocuments(types);
    } catch (err) {
      notifyUser(err.message || "Erreur chargement types", "error");
      setTypesAvecDocuments([]);
    }
  }, [notifyUser]);

  const buildDocumentQuery = useCallback(
    (activeFilters, offset = 0, localiteId = selectedLocalite?.id) => ({
      localiteId,
      typeDocumentId: activeFilters.typeDocumentId || undefined,
      q: activeFilters.search || undefined,
      dateDebut: activeFilters.dateDebut || undefined,
      dateFin: activeFilters.dateFin || undefined,
      format: activeFilters.format || undefined,
      champFilters: activeFilters.champFilters,
      columnFilters: activeFilters.columnFilters,
      offset,
      limit: DOCUMENT_PAGE_SIZE,
    }),
    [selectedLocalite?.id]
  );

  const clearSelection = useCallback(() => {
    setSelectedDocIds(new Set());
  }, []);

  const toggleDocSelection = useCallback((id) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(async () => {
    if (total > 0 && selectedDocIds.size === total) {
      clearSelection();
      return;
    }
    if (!total) return;

    try {
      setSelectingAll(true);
      const query = buildDocumentQuery(appliedFilters, 0, selectedLocalite?.id);
      const ids = await getAllMatchingDocumentIds({ ...query, statutQualite: STATUT_VALIDE });
      setSelectedDocIds(new Set(ids));
    } catch (err) {
      notifyUser(err.message || "Impossible de sélectionner tous les documents", "error");
    } finally {
      setSelectingAll(false);
    }
  }, [
    total,
    selectedDocIds.size,
    clearSelection,
    buildDocumentQuery,
    appliedFilters,
    selectedLocalite?.id,
    notifyUser,
  ]);

  const allMatchingSelected = total > 0 && selectedDocIds.size === total;
  const someSelected = selectedDocIds.size > 0 && !allMatchingSelected;

  const selectedDocs = useMemo(
    () => documents.filter((doc) => selectedDocIds.has(doc.id)),
    [documents, selectedDocIds]
  );

  const loadDocuments = useCallback(
    async (
      offset = 0,
      activeFilters = appliedFilters,
      localiteId = selectedLocalite?.id,
      { keepSelection = false } = {}
    ) => {
      try {
        setLoading(true);
        const query = buildDocumentQuery(activeFilters, offset, localiteId);
        const res = await getDocuments({ ...query, statutQualite: STATUT_VALIDE });
        setDocuments(res.results);
        setTotal(res.total);
        setHasMore(res.has_more);
        setPageOffset(res.offset);
        if (!keepSelection) setSelectedDocIds(new Set());
      } catch (err) {
        notifyUser(err.message || "Erreur chargement documents", "error");
        setDocuments([]);
        setTotal(0);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, selectedLocalite?.id, notifyUser, buildDocumentQuery]
  );

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
    loadTypes();
    loadDocuments(0, EMPTY_FILTERS, null);
    getStructuresGeographiques()
      .then((data) => {
        setStructures(Array.isArray(data) ? data : []);
      })
      .catch(() => setStructures([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTypes(selectedLocalite?.id ?? null);
  }, [selectedLocalite?.id, loadTypes]);

  useEffect(() => {
    loadChampsForType(appliedFilters.typeDocumentId);
  }, [appliedFilters.typeDocumentId, loadChampsForType]);

  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allColumns.forEach((col) => {
        if (next[col.key] === undefined) next[col.key] = true;
      });
      return next;
    });
  }, [allColumns]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setAppliedFilters((prev) => {
        if (prev.search === filters.search) return prev;
        const next = { ...prev, search: filters.search };
        setPageOffset(0);
        loadDocuments(0, next, selectedLocalite?.id);
        return next;
      });
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [filters.search, selectedLocalite?.id, loadDocuments]);

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
    loadDocuments(0, next, selectedLocalite?.id);
  };

  const handleColumnFilterApply = (columnKey, filter) => {
    const columnFilters = { ...filters.columnFilters };
    if (filter) columnFilters[columnKey] = filter;
    else delete columnFilters[columnKey];
    const next = { ...filters, columnFilters };
    setFilters(next);
    setAppliedFilters(next);
    setPageOffset(0);
    loadDocuments(0, next, selectedLocalite?.id);
  };

  const handleLocaliteSelect = (localite) => {
    setSelectedLocalite(localite);
    const next = { ...appliedFilters, typeDocumentId: "", champFilters: {}, columnFilters: {} };
    setFilters(next);
    setAppliedFilters(next);
    setPageOffset(0);
    loadDocuments(0, next, localite?.id);
  };

  const clearLocalite = () => {
    setSelectedLocalite(null);
    const next = { ...appliedFilters, typeDocumentId: "", champFilters: {}, columnFilters: {} };
    setFilters(next);
    setAppliedFilters(next);
    setPageOffset(0);
    loadTypes();
    loadDocuments(0, next, null);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelectedLocalite(null);
    setPageOffset(0);
    loadTypes();
    loadDocuments(0, EMPTY_FILTERS, null);
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
      `/gestion_documentaire/plan_geographique/${doc.localite}/documents/${doc.id}/modifier`
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

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteIds.length) return;
    try {
      setDeleting(true);
      const { deleted } = await deleteDocumentsLocalite(bulkDeleteIds);
      if (previewDoc && bulkDeleteIds.includes(previewDoc.id)) setPreviewDoc(null);
      setBulkDeleteIds([]);
      const remainingOnPage = documents.length - deleted;
      const nextOffset =
        remainingOnPage <= 0 && pageOffset > 0
          ? Math.max(0, pageOffset - DOCUMENT_PAGE_SIZE)
          : pageOffset;
      await loadDocuments(nextOffset);
      notifyUser(
        `${deleted} document${deleted > 1 ? "s" : ""} supprimé${deleted > 1 ? "s" : ""} avec succès`,
        "success"
      );
    } catch (err) {
      notifyUser(err.message || "Erreur lors de la suppression", "error");
      await loadDocuments(pageOffset);
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
    Boolean(selectedLocalite) ||
    Boolean(appliedFilters.search) ||
    Boolean(appliedFilters.typeDocumentId) ||
    Boolean(appliedFilters.format) ||
    Boolean(appliedFilters.dateDebut) ||
    Boolean(appliedFilters.dateFin) ||
    hasColumnFilterValues(appliedFilters.columnFilters);

  const goToPrevPage = () => {
    if (pageOffset <= 0) return;
    loadDocuments(Math.max(0, pageOffset - DOCUMENT_PAGE_SIZE), appliedFilters, selectedLocalite?.id, {
      keepSelection: true,
    });
  };

  const goToNextPage = () => {
    if (!hasMore) return;
    loadDocuments(pageOffset + DOCUMENT_PAGE_SIZE, appliedFilters, selectedLocalite?.id, {
      keepSelection: true,
    });
  };

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

      <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white shrink-0 overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-24 bottom-0 w-24 h-24 rounded-full bg-teal-400/20" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-medium mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Gestion documentaire
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Liste des documents</h3>
            <p className="text-emerald-100 mt-1.5">
              Consultez l'ensemble des documents rattachés aux sites.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-bold shadow-md">
              {total} document{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 flex-1 min-h-0 min-w-0 flex flex-col">
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

            {canDelete && selectedDocIds.size > 0 && (
              <button
                type="button"
                onClick={() => setBulkDeleteIds(Array.from(selectedDocIds))}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-xl text-sm text-red-700 bg-red-50 hover:bg-red-100 transition cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer la sélection ({selectedDocIds.size})
              </button>
            )}

            {canDelete && selectedDocIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Désélectionner
              </button>
            )}

            {selectedTypeInfo && (
              <span className="text-sm text-emerald-700 font-medium">
                Filtre actif : {selectedTypeInfo.libelle}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
            <div>
              <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Recherche textuelle
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Site, métadonnées…"
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>

            <div className="relative z-40 overflow-visible">
              <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Site
              </label>
              {selectedLocalite ? (
                <div className="flex items-center gap-2 border border-emerald-200 rounded-xl px-3 py-2.5 bg-emerald-50/50 min-h-[42px]">
                  <span
                    className="text-sm text-gray-800 flex-1 truncate"
                    title={selectedLocalite.chemin_str || selectedLocalite.libelle}
                  >
                    {selectedLocalite.libelle}
                  </span>
                  <button
                    type="button"
                    onClick={clearLocalite}
                    className="text-emerald-700 hover:text-red-600 shrink-0 cursor-pointer"
                    title="Effacer le filtre localité"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <PlanGeoSearch onSelect={handleLocaliteSelect} />
              )}
            </div>

            <div>
              <label htmlFor="filtre-type-global" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Type de document
              </label>
              <select
                id="filtre-type-global"
                value={filters.typeDocumentId}
                onChange={(e) => applySelectFilters("typeDocumentId", e.target.value)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm"
              >
                <option value="">Tous les types</option>
                {typesAvecDocuments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.libelle} ({t.code}) — {t.count} doc{t.count !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtre-format" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Format
              </label>
              <select
                id="filtre-format"
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
              <label htmlFor="filtre-date-debut" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Période début
              </label>
              <input
                id="filtre-date-debut"
                type="date"
                value={filters.dateDebut}
                onChange={(e) => applySelectFilters("dateDebut", e.target.value)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="filtre-date-fin" className="block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Période fin
              </label>
              <input
                id="filtre-date-fin"
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

        <DocumentListSplitView
          previewDoc={previewDoc}
          onClosePreview={() => setPreviewDoc(null)}
          onDownload={(doc, previewSource) => handleDownload(doc, getFilename, notifyUser, previewSource)}
          getFilename={getFilename}
          listScrollRef={tableScrollRef}
        >
        <div
          ref={tableScrollRef}
          className={`flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto relative z-0 ${
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                {hasActiveFilters ? "Aucun document ne correspond aux filtres" : "Aucun document enregistré"}
              </p>
            </div>
          ) : (
            <table className="min-w-full w-max text-sm border-collapse">
              <DocumentTableHead
                columns={activeColumns}
                thCellClass={TH_CELL}
                selection={
                  canDelete
                    ? {
                        allSelected: allMatchingSelected,
                        indeterminate: someSelected,
                        disabled: selectingAll || loading,
                        title:
                          total > 0
                            ? `Tout sélectionner (${total} document${total > 1 ? "s" : ""})`
                            : "Tout sélectionner",
                        onToggleAll: toggleSelectAll,
                      }
                    : undefined
                }
              />
              <tbody>
                {documents.map((doc, index) => {
                  const format = getFileFormat(doc);
                  const isSelected = selectedDocIds.has(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-emerald-200 transition-colors hover:bg-emerald-50/70 ${
                        previewDoc?.id === doc.id
                          ? "bg-emerald-100/80 ring-1 ring-inset ring-emerald-300"
                          : isSelected
                            ? "bg-red-50/60"
                            : index % 2 === 0
                              ? "bg-white"
                              : "bg-emerald-50/20"
                      }`}
                    >
                      {canDelete && (
                        <td className={`${TD_CELL} w-12 text-center border-r border-emerald-100`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDocSelection(doc.id)}
                            className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            aria-label={`Sélectionner ${doc.type_document_libelle || "document"}`}
                          />
                        </td>
                      )}
                      {activeColumns.map((col) => (
                        <td key={col.key} className={TD_CELL}>
                          {col.key.startsWith("geo_") && (
                            <span className="text-gray-800 font-medium">
                              {getCheminEntry(doc, col.niveauOrdre)?.libelle || "—"}
                            </span>
                          )}
                          {col.key === "localite" && (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/gestion_documentaire/plan_geographique/${doc.localite}/documents`
                                )
                              }
                              className="text-emerald-700 hover:text-emerald-900 font-medium hover:underline cursor-pointer text-left"
                            >
                              {getLeafLocaliteLabel(doc)}
                            </button>
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
                            Voir
                          </ActionButton>
                          <ActionButton
                            variant="download"
                            title="Télécharger"
                            disabled={!doc.fichier_url}
                            onClick={() => handleDownload(doc, getFilename, notifyUser)}
                          >
                            Télécharger
                          </ActionButton>
                          {canChange && (
                          <ActionButton variant="edit" title="Modifier" onClick={() => goToEdit(doc)}>
                            Modifier
                          </ActionButton>
                          )}
                          {canDelete && (
                          <ActionButton variant="delete" title="Supprimer" onClick={() => setDeleteDoc(doc)}>
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
                <strong className="text-gray-900">{deleteDoc.type_document_libelle}</strong> (
                {getFileFormat(deleteDoc)}) ?
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

      {bulkDeleteIds.length > 0 && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100">
            <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white">
              <h4 className="text-lg font-semibold">Supprimer la sélection</h4>
            </div>
            <div className="p-6">
              <p className="text-gray-700">
                Confirmez la suppression de{" "}
                <strong className="text-gray-900">
                  {bulkDeleteIds.length} document{bulkDeleteIds.length > 1 ? "s" : ""}
                </strong>{" "}
                ?
              </p>
              {selectedDocs.length > 0 && selectedDocs.length <= 5 && (
                <ul className="mt-3 text-sm text-gray-600 list-disc list-inside space-y-1">
                  {selectedDocs.map((doc) => (
                    <li key={doc.id}>
                      {doc.type_document_libelle || "Document"} — {getLeafLocaliteLabel(doc)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-red-600 mt-2">Cette action est irréversible.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBulkDeleteIds([])}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-white transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
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
