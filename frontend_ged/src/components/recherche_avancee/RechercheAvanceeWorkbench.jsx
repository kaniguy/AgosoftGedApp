"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChampsDocuments } from "../../services/champsDocument.service";
import {
  downloadDocumentLocalite,
  downloadDocumentsArchive,
  getDocuments,
  getTypesAvecDocuments,
} from "../../services/documentLocalite.service";
import {
  getDefaultOperator,
  getOperatorsForFamily,
} from "../../utils/documentColumnFilters";
import { formatChampValue, formatDisplayDateTime } from "../../utils/dateFormat";
import { getStructuresGeographiques } from "../../services/structureGeo.service";
import {
  buildRechercheResultColumns,
  buildSearchableFields,
  collectQrChampsFromTypes,
  collectCodeBarreChampsFromTypes,
  countIndexChampFields,
  criteriaToColumnFilters,
  getActiveResultColumns,
  getKeywordMatchesForDocument,
  getSearchFieldFilterFamily,
  getValueSelectOptions,
  inputTypeForField,
  RECHERCHE_PAGE_SIZE,
} from "../../utils/rechercheAvancee";
import DocumentPreview from "../gestion_documentaire/documents/DocumentPreview";
import DocumentPreviewVersionSelect from "../gestion_documentaire/documents/DocumentPreviewVersionSelect";
import { useDocumentPreviewVersions } from "../../hooks/useDocumentPreviewVersions";
import DocumentColumnVisibilityMenu from "../gestion_documentaire/documents/DocumentColumnVisibilityMenu";
import ChampCellValue from "../gestion_documentaire/documents/ChampCellValue";
import LienTelechargementModal from "./LienTelechargementModal";
import SearchableSelect from "../ui/SearchableSelect";
import ResizableThreePane from "../ui/ResizableThreePane";
import { getCheminEntry, getLeafLocaliteLabel } from "../../utils/documentGeoColumns";
import { useCrudPermissions, MODELS } from "../../utils/permissions";
import { STATUT_VALIDE } from "../../utils/documentStatutQualite";

let criterionId = 0;
function newCriterion() {
  criterionId += 1;
  return { id: criterionId, fieldKey: "", op: "", value: "", valueTo: "" };
}

const FORMAT_STYLES = {
  PDF: "bg-rose-50 text-rose-700 border-rose-200",
  JPEG: "bg-sky-50 text-sky-700 border-sky-200",
  PNG: "bg-indigo-50 text-indigo-700 border-indigo-200",
  WEBP: "bg-violet-50 text-violet-700 border-violet-200",
  GIF: "bg-pink-50 text-pink-700 border-pink-200",
};

function getFileFormat(doc) {
  const source = (doc.fichier_url || doc.fichier || "").toLowerCase();
  const nameMatch = source.match(/[?&]name=([^&]+)/);
  let candidate = source.split("?")[0];
  if (nameMatch?.[1]) {
    try {
      candidate = decodeURIComponent(nameMatch[1]);
    } catch {
      candidate = nameMatch[1];
    }
  }
  const ext = candidate.split(".").pop() || "";
  const labels = { pdf: "PDF", jpg: "JPEG", jpeg: "JPEG", png: "PNG", webp: "WEBP", gif: "GIF" };
  return labels[ext] || (ext && ext !== "fichier" ? ext.toUpperCase() : "—");
}

function getFilename(doc) {
  const url = doc.fichier_url || doc.fichier || "";
  const nameMatch = url.match(/[?&]name=([^&]+)/);
  if (nameMatch?.[1]) {
    try {
      return decodeURIComponent(nameMatch[1]);
    } catch {
      return nameMatch[1];
    }
  }
  const fromUrl = url.split("/").pop()?.split("?")[0];
  if (fromUrl && fromUrl !== "fichier") return fromUrl;
  const type = doc.type_document_libelle || "document";
  const ext = getFileFormat(doc).toLowerCase();
  return `${type}.${ext === "jpeg" ? "jpg" : ext === "—" ? "pdf" : ext}`;
}

function mergeDocumentsById(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const doc of list) {
      map.set(doc.id, doc);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.date_creation) - new Date(a.date_creation)
  );
}

function getResultColumnExportValue(col, doc, keyword = "", rowNumber = "") {
  if (col.key === "numero") return String(rowNumber);
  if (col.key === "format") return getFileFormat(doc);
  if (col.key === "type") return doc.type_document_libelle || "";
  if (col.key === "keyword_match") {
    const { indexFields } = getKeywordMatchesForDocument(doc, keyword);
    return indexFields.map((m) => `${m.libelleChamp}: ${m.valeur}`).join(" ; ");
  }
  if (col.key.startsWith("geo_")) {
    return getCheminEntry(doc, col.niveauOrdre)?.libelle || "";
  }
  if (col.key.startsWith("champ_")) {
    const found = (doc.valeurs || []).find((v) => v.champ_id === col.champId);
    return formatChampValue(found?.valeur, col.typeChamp);
  }
  if (col.key === "localite") return getLeafLocaliteLabel(doc);
  if (col.key === "date") return formatDisplayDateTime(doc.date_creation);
  return "";
}

function exportCsv(documents, columns = [], keyword = "", pageOffset = 0) {
  const headers = [...columns.map((col) => col.label), "Fichier"];
  const rows = documents.map((d, index) => [
    ...columns.map((col) => getResultColumnExportValue(col, d, keyword, pageOffset + index + 1)),
    getFilename(d),
  ]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recherche-documents-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function KeywordMatchCell({ doc, keyword }) {
  const { indexFields, otherSources } = getKeywordMatchesForDocument(doc, keyword);

  if (indexFields.length) {
    return (
      <div className="space-y-1.5">
        {indexFields.map((m) => (
          <div key={m.champId}>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-100">
              {m.libelleChamp}
            </span>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[14rem]" title={m.valeur}>
              <ChampCellValue value={m.valeur} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (otherSources.length) {
    return (
      <span className="text-[11px] text-slate-400 italic" title="Correspondance hors champ index">
        {otherSources.join(" · ")}
      </span>
    );
  }

  return <span className="text-[11px] text-slate-300">—</span>;
}

function renderResultCell(col, doc, { formatStyle, format, activeKeyword, rowNumber }) {
  if (col.key === "numero") {
    return <span className="text-slate-500 tabular-nums font-medium">{rowNumber}</span>;
  }
  if (col.key === "format") {
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${formatStyle}`}>
        {format}
      </span>
    );
  }
  if (col.key === "type") {
    return <span className="font-medium text-slate-800 truncate block">{doc.type_document_libelle || "—"}</span>;
  }
  if (col.key === "keyword_match") {
    return <KeywordMatchCell doc={doc} keyword={activeKeyword} />;
  }
  if (col.key.startsWith("geo_")) {
    return (
      <span className="text-slate-600 truncate block">
        {getCheminEntry(doc, col.niveauOrdre)?.libelle || "—"}
      </span>
    );
  }
  if (col.key.startsWith("champ_")) {
    const found = (doc.valeurs || []).find((v) => v.champ_id === col.champId);
    return <ChampCellValue value={found?.valeur} typeChamp={col.typeChamp} />;
  }
  if (col.key === "localite") {
    return <span className="text-slate-600 truncate block">{getLeafLocaliteLabel(doc)}</span>;
  }
  if (col.key === "date") {
    return <span className="text-slate-500 whitespace-nowrap">{formatDisplayDateTime(doc.date_creation)}</span>;
  }
  return "—";
}

function CriterionRow({ row, fieldOptions, fields, onChange, onRemove, canRemove }) {
  const field = fields.find((f) => f.key === row.fieldKey) || null;
  const family = getSearchFieldFilterFamily(field);
  const operators = getOperatorsForFamily(family);
  const effectiveOp = row.op || operators[0]?.id || "contains";
  const selectOptions = getValueSelectOptions(field);
  const inputType = inputTypeForField(field);
  const showBetween = effectiveOp === "between";
  const useSelect = Boolean(selectOptions?.length);

  const handleFieldChange = (fieldKey) => {
    const nextField = fields.find((f) => f.key === fieldKey);
    const nextFamily = getSearchFieldFilterFamily(nextField);
    onChange({
      ...row,
      fieldKey,
      op: getDefaultOperator(nextFamily),
      value: "",
      valueTo: "",
    });
  };

  return (
    <div className="group rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm hover:border-cyan-200 hover:shadow-md transition-all">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Champ index
          </label>
          <SearchableSelect
            options={fieldOptions}
            value={row.fieldKey}
            onChange={handleFieldChange}
            placeholder="Choisir un champ…"
            searchPlaceholder="Rechercher un champ index…"
            accent="cyan"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Opérateur
            </label>
            <select
              value={effectiveOp}
              disabled={!row.fieldKey}
              onChange={(e) => onChange({ ...row, op: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm disabled:opacity-50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Valeur
            </label>
            {useSelect ? (
              <select
                value={row.value}
                disabled={!row.fieldKey}
                onChange={(e) => onChange({ ...row, value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm disabled:opacity-50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
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
                value={row.value}
                disabled={!row.fieldKey}
                onChange={(e) => onChange({ ...row, value: e.target.value })}
                placeholder="Saisir…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm disabled:opacity-50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
              />
            )}
          </div>
        </div>

        {showBetween && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Valeur (fin)
            </label>
            <input
              type={inputType}
              value={row.valueTo}
              onChange={(e) => onChange({ ...row, valueTo: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
            />
          </div>
        )}
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Retirer
        </button>
      )}
    </div>
  );
}

export default function RechercheAvanceeWorkbench({ onNotify }) {
  const [types, setTypes] = useState([]);
  const [structures, setStructures] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedTypeIds, setSelectedTypeIds] = useState([]);
  const [champsByType, setChampsByType] = useState({});
  const [criteria, setCriteria] = useState([newCriterion()]);
  const [logic, setLogic] = useState("and");
  const [includeFullText, setIncludeFullText] = useState(true);
  const [fullTextQuery, setFullTextQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);
  const [orModeAllDocs, setOrModeAllDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [previewDoc, setPreviewDoc] = useState(null);
  const {
    loading: versionsLoading,
    selectedKey,
    setSelectedKey,
    versionOptions,
    previewSource,
    showVersionSelect,
  } = useDocumentPreviewVersions(previewDoc);
  const [downloadingArchive, setDownloadingArchive] = useState(false);
  const [lienModalOpen, setLienModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({});
  const filterDebounceRef = useRef(null);
  const { canAdd: canCreateDownloadLink } = useCrudPermissions(MODELS.LIEN_TELECHARGEMENT);

  const typesMap = useMemo(() => {
    const map = {};
    types.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [types]);

  const filteredTypes = useMemo(() => {
    const q = typeFilter.trim().toLowerCase();
    if (!q) return types;
    return types.filter(
      (t) => t.libelle?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
    );
  }, [types, typeFilter]);

  const searchableFields = useMemo(
    () => buildSearchableFields(champsByType, selectedTypeIds, typesMap, structures, types),
    [champsByType, selectedTypeIds, typesMap, structures, types]
  );

  const indexChampCount = useMemo(
    () => countIndexChampFields(searchableFields),
    [searchableFields]
  );

  const activeKeyword = useMemo(
    () => (includeFullText ? fullTextQuery.trim() : ""),
    [includeFullText, fullTextQuery]
  );

  const allResultColumns = useMemo(() => {
    const qrChamps = collectQrChampsFromTypes(champsByType, selectedTypeIds);
    const codeBarreChamps = collectCodeBarreChampsFromTypes(champsByType, selectedTypeIds);
    return buildRechercheResultColumns(structures, { qrChamps, codeBarreChamps });
  }, [structures, champsByType, selectedTypeIds]);

  const activeResultColumns = useMemo(
    () => getActiveResultColumns(allResultColumns, visibleColumns, { activeKeyword }),
    [allResultColumns, visibleColumns, activeKeyword]
  );

  const fieldSelectOptions = useMemo(
    () =>
      searchableFields.map((f) => ({
        value: f.key,
        label: f.label,
        group: f.group || "Colonnes fixes",
      })),
    [searchableFields]
  );

  const notify = useCallback(
    (message, type = "success") => onNotify?.(message, type),
    [onNotify]
  );

  useEffect(() => {
    getTypesAvecDocuments(null, { statutQualite: STATUT_VALIDE })
      .then(setTypes)
      .catch((err) => notify(err.message || "Erreur chargement types", "error"));
  }, [notify]);

  useEffect(() => {
    getStructuresGeographiques()
      .then(setStructures)
      .catch((err) => notify(err.message || "Erreur chargement plan de classement", "error"));
  }, [notify]);

  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allResultColumns.forEach((col) => {
        if (next[col.key] === undefined) next[col.key] = true;
      });
      return next;
    });
  }, [allResultColumns]);

  useEffect(() => {
    let cancelled = false;

    async function loadChamps() {
      if (!selectedTypeIds.length) return;

      const entries = await Promise.all(
        selectedTypeIds.map(async (typeId) => {
          try {
            const data = await getChampsDocuments(typeId);
            const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.ordre - b.ordre) : [];
            return [typeId, sorted];
          } catch {
            return [typeId, []];
          }
        })
      );

      if (cancelled) return;
      setChampsByType((prev) => {
        const next = { ...prev };
        entries.forEach(([id, champs]) => {
          if (!next[id]) next[id] = champs;
        });
        return next;
      });
    }

    loadChamps();
    return () => {
      cancelled = true;
    };
  }, [selectedTypeIds]);

  useEffect(() => {
    if (!searchableFields.length) return;
    setCriteria((prev) =>
      prev.map((row) => {
        if (row.fieldKey && row.op) return row;
        const field = searchableFields.find((f) => f.key === row.fieldKey) || searchableFields[0];
        const family = getSearchFieldFilterFamily(field);
        return {
          ...row,
          fieldKey: row.fieldKey || field.key,
          op: row.op || getDefaultOperator(family),
        };
      })
    );
  }, [searchableFields]);

  const toggleType = (id) => {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllTypes = () => {
    if (selectedTypeIds.length === filteredTypes.length) {
      setSelectedTypeIds([]);
    } else {
      setSelectedTypeIds(filteredTypes.map((t) => t.id));
    }
  };

  const fetchDocuments = useCallback(
    async (offset = 0, { resetSelection = false } = {}) => {
      setLoading(true);
      if (resetSelection) {
        setPreviewDoc(null);
        setSelectedDocIds(new Set());
      }

      const base = {
        typeDocumentIds: selectedTypeIds.length ? selectedTypeIds : undefined,
        q: includeFullText && fullTextQuery.trim() ? fullTextQuery.trim() : undefined,
        statutQualite: STATUT_VALIDE,
        offset,
        limit: RECHERCHE_PAGE_SIZE,
      };

      try {
        const activeCriteria = criteria.filter((row) => {
          if (!row.fieldKey) return false;
          const field = searchableFields.find((f) => f.key === row.fieldKey);
          const op =
            row.op || getDefaultOperator(getSearchFieldFilterFamily(field));
          const value = String(row.value ?? "").trim();
          if (op === "between") return value && String(row.valueTo ?? "").trim();
          return Boolean(value);
        });

        const hasCriteria = activeCriteria.length > 0;

        if (logic === "and" || !hasCriteria) {
          const columnFilters = hasCriteria
            ? criteriaToColumnFilters(criteria, searchableFields)
            : {};
          const res = await getDocuments({ ...base, columnFilters });
          setDocuments(res.results);
          setTotal(res.total);
          setPageOffset(res.offset);
          setOrModeAllDocs([]);
        } else {
          const requests = [];
          if (base.q) {
            requests.push(getDocuments({ ...base, columnFilters: {}, limit: 200, offset: 0 }));
          }
          for (const row of activeCriteria) {
            const field = searchableFields.find((f) => f.key === row.fieldKey);
            const op =
              row.op || getDefaultOperator(getSearchFieldFilterFamily(field));
            const columnFilters = {
              [row.fieldKey]: {
                op,
                value: row.value,
                ...(op === "between" ? { valueTo: row.valueTo } : {}),
              },
            };
            requests.push(getDocuments({ ...base, columnFilters, limit: 200, offset: 0 }));
          }
          const responses = await Promise.all(requests);
          const merged = mergeDocumentsById(responses.map((r) => r.results));
          setOrModeAllDocs(merged);
          const page = merged.slice(offset, offset + RECHERCHE_PAGE_SIZE);
          setDocuments(page);
          setTotal(merged.length);
          setPageOffset(offset);
        }
      } catch (err) {
        notify(err.message || "Erreur lors du chargement", "error");
        setDocuments([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [criteria, fullTextQuery, includeFullText, logic, notify, searchableFields, selectedTypeIds]
  );

  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      fetchDocuments(0);
    }, 450);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [criteria, fullTextQuery, includeFullText, logic, selectedTypeIds, fetchDocuments]);

  const runSearch = () => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    fetchDocuments(0, { resetSelection: true });
  };

  const clearSearch = async () => {
    setCriteria([newCriterion()]);
    setFullTextQuery("");
    setLogic("and");
    setPreviewDoc(null);
    setSelectedDocIds(new Set());
    setOrModeAllDocs([]);
    setLoading(true);
    try {
      const res = await getDocuments({
        typeDocumentIds: selectedTypeIds.length ? selectedTypeIds : undefined,
        statutQualite: STATUT_VALIDE,
        offset: 0,
        limit: RECHERCHE_PAGE_SIZE,
      });
      setDocuments(res.results);
      setTotal(res.total);
      setPageOffset(res.offset);
    } catch (err) {
      notify(err.message || "Erreur lors de la réinitialisation", "error");
    } finally {
      setLoading(false);
    }
  };

  const addCriterion = () => {
    const firstField = searchableFields[0];
    const family = firstField ? getSearchFieldFilterFamily(firstField) : "text";
    setCriteria((prev) => [
      ...prev,
      {
        ...newCriterion(),
        fieldKey: firstField?.key || "",
        op: getDefaultOperator(family),
      },
    ]);
  };

  const updateCriterion = (id, next) => {
    setCriteria((prev) => prev.map((row) => (row.id === id ? next : row)));
  };

  const removeCriterion = (id) => {
    setCriteria((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const goToPage = (offset) => {
    if (logic === "or" && orModeAllDocs.length) {
      setPageOffset(offset);
      setDocuments(orModeAllDocs.slice(offset, offset + RECHERCHE_PAGE_SIZE));
    } else {
      fetchDocuments(offset);
    }
  };

  const toggleDocSelection = (id) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllDocs = () => {
    if (selectedDocIds.size === documents.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
    }
  };

  const selectedDocs = documents.filter((d) => selectedDocIds.has(d.id));

  const handleBulkDownload = async () => {
    if (!selectedDocs.length) {
      notify("Sélectionnez au moins un document.", "error");
      return;
    }
    if (selectedDocs.length === 1) {
      const doc = selectedDocs[0];
      try {
        await downloadDocumentLocalite(doc, getFilename(doc));
        notify("Document téléchargé.");
      } catch (err) {
        notify(err.message || "Téléchargement impossible", "error");
      }
      return;
    }

    setDownloadingArchive(true);
    try {
      const { filename } = await downloadDocumentsArchive(selectedDocs.map((d) => d.id));
      const isRar = filename.toLowerCase().endsWith(".rar");
      notify(
        `Archive ${isRar ? "RAR" : "ZIP"} de ${selectedDocs.length} document(s) téléchargée.`
      );
    } catch (err) {
      notify(err.message || "Impossible de créer l'archive", "error");
    } finally {
      setDownloadingArchive(false);
    }
  };

  const handleExportCsv = () => {
    const toExport = selectedDocs.length ? selectedDocs : documents;
    if (!toExport.length) {
      notify("Aucun document à exporter.", "error");
      return;
    }
    exportCsv(toExport, activeResultColumns, activeKeyword, pageOffset);
    notify("Export CSV généré.");
  };

  const toggleResultColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showAllResultColumns = () => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allResultColumns.forEach((col) => {
        next[col.key] = true;
      });
      return next;
    });
  };

  const hideAllResultColumns = () => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      allResultColumns.forEach((col) => {
        next[col.key] = false;
      });
      return next;
    });
  };

  const hasMore = pageOffset + RECHERCHE_PAGE_SIZE < total;
  const resultsCountLabel = useMemo(() => {
    if (loading && !documents.length) return "Chargement…";
    if (!total) return "Aucun document";
    const from = pageOffset + 1;
    const to = Math.min(pageOffset + documents.length, total);
    return `${total} document${total !== 1 ? "s" : ""} · ${from}–${to} · ${RECHERCHE_PAGE_SIZE}/page`;
  }, [loading, documents.length, total, pageOffset]);
  const hasPrev = pageOffset > 0;

  const panelShell = "flex flex-col h-full min-h-0 rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50 overflow-hidden";

  const typesPanel = (
    <aside className={panelShell}>
          <div className="px-4 py-3.5 bg-gradient-to-r from-cyan-600 to-sky-600 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Types de documents</h2>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
                {selectedTypeIds.length} sélectionné{selectedTypeIds.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                placeholder="Filtrer les types…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-cyan-50/50 transition">
            <input
              type="checkbox"
              checked={filteredTypes.length > 0 && selectedTypeIds.length === filteredTypes.length}
              onChange={toggleAllTypes}
              className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm font-medium text-slate-700">Tout sélectionner</span>
          </label>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredTypes.map((type) => {
              const checked = selectedTypeIds.includes(type.id);
              return (
                <label
                  key={type.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                    checked ? "bg-cyan-50 border border-cyan-200" : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(type.id)}
                    className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-600">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate">{type.libelle}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 ml-6">{type.count} document{type.count > 1 ? "s" : ""}</span>
                  </div>
                </label>
              );
            })}
            {!filteredTypes.length && (
              <p className="text-sm text-slate-400 text-center py-8">Aucun type trouvé</p>
            )}
          </div>
        </aside>
  );

  const criteriaPanel = (
        <section className={panelShell}>
          <div className="px-4 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <h2 className="text-sm font-semibold">Critères de recherche</h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {indexChampCount} champ(s) index disponible(s)
              {selectedTypeIds.length ? "" : " — sélectionnez des types pour les champs métier"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <label className="flex items-center gap-2 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFullText}
                onChange={(e) => setIncludeFullText(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-700">Inclure le texte intégral</span>
            </label>

            {includeFullText && (
              <input
                type="text"
                value={fullTextQuery}
                onChange={(e) => setFullTextQuery(e.target.value)}
                placeholder="Mot-clé global (localité, type, champs index…)…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
              />
            )}

            <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 rounded-xl">
              {[
                { id: "and", label: "ET" },
                { id: "or", label: "OU" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLogic(opt.id)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    logic === opt.id
                      ? "bg-white text-cyan-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {criteria.map((row) => (
              <CriterionRow
                key={row.id}
                row={row}
                fieldOptions={fieldSelectOptions}
                fields={searchableFields}
                onChange={(next) => updateCriterion(row.id, next)}
                onRemove={removeCriterion}
                canRemove={criteria.length > 1}
              />
            ))}

            <button
              type="button"
              onClick={addCriterion}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-cyan-200 text-cyan-700 text-sm font-medium hover:bg-cyan-50 hover:border-cyan-300 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un critère
            </button>
          </div>

          <div className="p-3 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white text-sm font-semibold shadow-md shadow-cyan-200 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-60 transition"
            >
              {loading ? "Recherche…" : "Rechercher"}
            </button>
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition"
            >
              Effacer
            </button>
          </div>
        </section>
  );

  const resultsPanel = (
        <section className={panelShell}>
          {previewDoc ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-gradient-to-r from-cyan-50 to-sky-50">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-200 bg-white text-cyan-800 text-sm font-medium hover:bg-cyan-50 transition shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Retour
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-800 truncate">
                      {previewDoc.type_document_libelle}
                    </h2>
                    <p className="text-xs text-slate-500 truncate">
                      {previewDoc.localite_libelle} · {getFilename(previewDoc)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  title="Télécharger"
                  onClick={() =>
                    downloadDocumentLocalite(previewDoc, getFilename(previewDoc))
                  }
                  className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-cyan-700 transition shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden bg-slate-50">
                <DocumentPreview
                  key={`${previewDoc.id}-${selectedKey}-${previewSource?.previewUrl || ""}`}
                  previewUrl={previewSource?.previewUrl}
                  previewFileName={getFilename(previewDoc)}
                  large
                  zoomable
                  annotations={previewSource?.annotations}
                  annotationsReadOnly={Boolean(previewSource?.annotations?.length)}
                  versionSelect={
                    showVersionSelect ? (
                      <DocumentPreviewVersionSelect
                        value={selectedKey}
                        options={versionOptions}
                        loading={versionsLoading}
                        onChange={setSelectedKey}
                      />
                    ) : null
                  }
                  onDownload={() => {
                    if (
                      previewSource?.downloadMode === "archived" &&
                      previewSource.archivedVersionId
                    ) {
                      downloadDocumentLocalite(previewDoc, getFilename(previewDoc), {
                        versionId: previewSource.archivedVersionId,
                      });
                      return;
                    }
                    downloadDocumentLocalite(previewDoc, getFilename(previewDoc));
                  }}
                  onClose={() => setPreviewDoc(null)}
                />
              </div>
            </>
          ) : (
            <>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 leading-tight">
              <h2 className="text-sm font-semibold text-slate-800">Résultats</h2>
              <p className="text-xs text-slate-500 mt-0.5">{resultsCountLabel}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <DocumentColumnVisibilityMenu
                allColumns={allResultColumns}
                visibleColumns={visibleColumns}
                onToggle={toggleResultColumn}
                onShowAll={showAllResultColumns}
                onHideAll={hideAllResultColumns}
                theme="cyan"
              />
              {canCreateDownloadLink && (
              <button
                type="button"
                title="Lien de téléchargement temporaire (copier ou envoyer par e-mail)"
                onClick={() => {
                  if (!selectedDocs.length) {
                    notify("Sélectionnez au moins un document.", "error");
                    return;
                  }
                  setLienModalOpen(true);
                }}
                disabled={!selectedDocIds.size}
                className="p-2 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
              )}
              <button
                type="button"
                title={selectedDocIds.size > 1 ? "Télécharger l'archive RAR" : "Télécharger la sélection"}
                onClick={handleBulkDownload}
                disabled={!selectedDocIds.size || downloadingArchive}
                className="p-2 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 transition"
              >
                {downloadingArchive ? (
                  <span className="w-5 h-5 block border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                title="Exporter CSV"
                onClick={handleExportCsv}
                disabled={!documents.length}
                className="p-2 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 relative">
              {loading && (
                <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="w-9 h-9 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {documents.length === 0 && !loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                  <p className="font-medium">Aucun document ne correspond</p>
                  <p className="text-sm mt-1">Modifiez les types ou les critères de filtre</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-gradient-to-r from-cyan-600 to-sky-600 text-white">
                        <tr>
                          <th className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={documents.length > 0 && selectedDocIds.size === documents.length}
                              onChange={toggleAllDocs}
                              className="rounded border-white/30"
                            />
                          </th>
                          {activeResultColumns.map((col) => (
                            <th
                              key={col.key}
                              className={`px-3 py-3 text-left text-xs font-bold uppercase tracking-wide ${
                                col.key === "numero" ? "w-12 text-center" : ""
                              } ${col.key === "keyword_match" ? "min-w-[10rem]" : ""}`}
                            >
                              {col.label}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documents.map((doc, index) => {
                          const format = getFileFormat(doc);
                          const formatStyle = FORMAT_STYLES[format] || "bg-slate-50 text-slate-600 border-slate-200";
                          const isSelected = selectedDocIds.has(doc.id);
                          const rowNumber = pageOffset + index + 1;
                          return (
                            <tr
                              key={doc.id}
                              className={`transition ${
                                isSelected ? "bg-sky-50/80" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDocSelection(doc.id)}
                                  className="rounded border-slate-300 text-cyan-600"
                                />
                              </td>
                              {activeResultColumns.map((col) => (
                                <td
                                  key={col.key}
                                  className={`px-3 py-3 max-w-[10rem] ${
                                    col.key === "numero" ? "w-12 text-center" : ""
                                  } ${col.key === "keyword_match" ? "align-top" : ""}`}
                                >
                                  {renderResultCell(col, doc, {
                                    formatStyle,
                                    format,
                                    activeKeyword,
                                    rowNumber,
                                  })}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="text-xs font-medium text-cyan-700 hover:text-cyan-900 px-2 py-1 rounded-lg hover:bg-cyan-50"
                                >
                                  Aperçu
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {(hasPrev || hasMore) && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                      <button
                        type="button"
                        disabled={!hasPrev || loading}
                        onClick={() => goToPage(Math.max(0, pageOffset - RECHERCHE_PAGE_SIZE))}
                        className="text-sm text-cyan-700 font-medium disabled:opacity-40 hover:underline"
                      >
                        ← Précédent
                      </button>
                      <span className="text-xs text-slate-500">
                        {pageOffset + 1}–{Math.min(pageOffset + RECHERCHE_PAGE_SIZE, total)} sur {total}
                      </span>
                      <button
                        type="button"
                        disabled={!hasMore || loading}
                        onClick={() => goToPage(pageOffset + RECHERCHE_PAGE_SIZE)}
                        className="text-sm text-cyan-700 font-medium disabled:opacity-40 hover:underline"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            </>
          )}
        </section>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[32rem]">
      <ResizableThreePane
        left={typesPanel}
        center={criteriaPanel}
        right={resultsPanel}
        defaultLeftPercent={22}
        defaultCenterPercent={28}
        accent="cyan"
      />
      {lienModalOpen && canCreateDownloadLink && (
        <LienTelechargementModal
          documentIds={selectedDocs.map((d) => d.id)}
          onClose={() => setLienModalOpen(false)}
          onNotify={notify}
        />
      )}
    </div>
  );
}
