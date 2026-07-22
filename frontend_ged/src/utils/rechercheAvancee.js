/**
 * Champs disponibles pour les critères de recherche avancée.
 */
import {
  FILTER_FAMILIES,
  getColumnFilterFamily,
  getDefaultOperator,
} from "./documentColumnFilters";
import { buildGeoColumns } from "./documentGeoColumns";

export const RECHERCHE_PAGE_SIZE = 15;

/** Colonnes affichées selon les cases cochées dans le menu « Colonnes visibles ». */
export function getActiveResultColumns(columns = [], visibleColumns = {}, { activeKeyword = "" } = {}) {
  const hasKeyword = Boolean(String(activeKeyword ?? "").trim());
  return columns.filter((col) => {
    if (visibleColumns[col.key] === false) return false;
    if (col.key === "keyword_match") return hasKeyword;
    return true;
  });
}

export const FORMAT_FIELD_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
];

const DOCUMENT_FIELDS = [
  { key: "format", label: "Format fichier", typeChamp: "select", options: FORMAT_FIELD_OPTIONS, group: "Document" },
  { key: "date", label: "Date d'enregistrement", typeChamp: "date", group: "Document" },
];

/** Construit la liste des champs index (géo + document + champs des types sélectionnés). */
export function buildSearchableFields(
  champsByType,
  selectedTypeIds,
  typesMap,
  structures = [],
  types = []
) {
  const geoFields = buildGeoColumns(structures).map((col) => ({
    key: col.key,
    label: col.label,
    typeChamp: "texte",
    group: "Plan géographique",
    isGeo: col.isGeo,
  }));

  const typeOptions = (types || []).map((t) => ({
    value: t.libelle,
    label: t.code ? `${t.libelle} (${t.code})` : t.libelle,
  }));

  const indexFields = [
    {
      key: "type",
      label: "Type de document",
      typeChamp: "select",
      group: "Champs index",
      options: typeOptions,
    },
  ];

  for (const typeId of selectedTypeIds) {
    const typeChamps = champsByType[typeId] || [];
    const typeLabel = typesMap[typeId]?.libelle || "";
    for (const champ of typeChamps) {
      indexFields.push({
        key: `champ_${champ.id}`,
        label:
          selectedTypeIds.length > 1
            ? `${champ.libelle_champ} (${typeLabel})`
            : champ.libelle_champ,
        typeChamp: champ.type_champ,
        group: "Champs index",
        options: (champ.options || []).map((o) => ({ value: o.valeur, label: o.valeur })),
      });
    }
  }

  return [...geoFields, ...DOCUMENT_FIELDS, ...indexFields];
}

/** Nombre de champs index dynamiques (hors géo et colonnes document). */
export function countIndexChampFields(searchableFields = []) {
  return searchableFields.filter((f) => f.key === "type" || f.key.startsWith("champ_")).length;
}

/** Colonnes du tableau de résultats (recherche avancée). */
export function buildRechercheResultColumns(structures = [], { qrChamps = [], codeBarreChamps = [] } = {}) {
  const geoColumns = buildGeoColumns(structures).map((col) => ({
    key: col.key,
    label: col.label,
    niveauOrdre: col.niveauOrdre,
    isGeo: col.isGeo,
    isLeaf: col.isLeaf,
  }));

  const qrColumns = (qrChamps || []).map((c) => ({
    key: `champ_${c.id}`,
    champId: c.id,
    typeChamp: "qr",
    label: c.libelle_champ || `Code QR ${c.id}`,
  }));

  const codeBarreColumns = (codeBarreChamps || []).map((c) => ({
    key: `champ_${c.id}`,
    champId: c.id,
    typeChamp: "code_barre",
    label: c.libelle_champ || `Code barre ${c.id}`,
  }));

  return [
    { key: "numero", label: "N°" },
    { key: "format", label: "Format" },
    { key: "type", label: "Type de document" },
    { key: "keyword_match", label: "Champ(s) index" },
    ...qrColumns,
    ...codeBarreColumns,
    ...geoColumns,
    { key: "date", label: "Date d'enregistrement" },
  ];
}

/** Champs Code QR uniques pour les types sélectionnés (colonnes résultats). */
export function collectQrChampsFromTypes(champsByType = {}, selectedTypeIds = []) {
  const seen = new Set();
  const list = [];
  for (const typeId of selectedTypeIds) {
    for (const champ of champsByType[typeId] || []) {
      if (champ.type_champ !== "qr" || seen.has(champ.id)) continue;
      seen.add(champ.id);
      list.push(champ);
    }
  }
  return list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

/** Champs Code barre uniques pour les types sélectionnés (colonnes résultats). */
export function collectCodeBarreChampsFromTypes(champsByType = {}, selectedTypeIds = []) {
  const seen = new Set();
  const list = [];
  for (const typeId of selectedTypeIds) {
    for (const champ of champsByType[typeId] || []) {
      if (champ.type_champ !== "code_barre" || seen.has(champ.id)) continue;
      seen.add(champ.id);
      list.push(champ);
    }
  }
  return list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

/** Convertit les lignes de critères en columnFilters pour l'API. */
export function criteriaToColumnFilters(criteria, searchableFields = []) {
  const fieldsByKey = Object.fromEntries(searchableFields.map((f) => [f.key, f]));
  const columnFilters = {};
  for (const row of criteria) {
    if (!row.fieldKey) continue;
    const field = fieldsByKey[row.fieldKey];
    const op = row.op || getDefaultOperator(getSearchFieldFilterFamily(field));
    const value = String(row.value ?? "").trim();
    const valueTo = String(row.valueTo ?? "").trim();
    if (op === "between") {
      if (!value || !valueTo) continue;
    } else if (!value) {
      continue;
    }
    columnFilters[row.fieldKey] = {
      op,
      value,
      ...(op === "between" ? { valueTo } : {}),
    };
  }
  return columnFilters;
}

/** Indique si au moins un critère ou le texte intégral est renseigné. */
export function hasActiveSearchInput(criteria, fullTextQuery, includeFullText) {
  if (includeFullText && String(fullTextQuery ?? "").trim()) return true;
  return criteria.some((row) => {
    if (!row.fieldKey) return false;
    const value = String(row.value ?? "").trim();
    if (row.op === "between") {
      return Boolean(value && String(row.valueTo ?? "").trim());
    }
    return Boolean(value);
  });
}

function normalizeForKeywordSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Champs index et autres sources où le mot-clé global apparaît dans un document.
 */
export function getKeywordMatchesForDocument(doc, query) {
  const q = normalizeForKeywordSearch(String(query ?? "").trim());
  if (!q) {
    return { indexFields: [], otherSources: [] };
  }

  const indexFields = [];
  for (const v of doc.valeurs || []) {
    if (normalizeForKeywordSearch(v.valeur).includes(q)) {
      indexFields.push({
        champId: v.champ_id,
        libelleChamp: v.libelle_champ,
        valeur: v.valeur,
      });
    }
  }

  const otherSources = [];
  if (normalizeForKeywordSearch(doc.type_document_libelle).includes(q)) {
    otherSources.push("Type de document");
  }
  if (normalizeForKeywordSearch(doc.localite_libelle).includes(q)) {
    otherSources.push("Localité");
  }
  for (const node of doc.localite_chemin || []) {
    const label = node.libelle || "";
    if (normalizeForKeywordSearch(label).includes(q) && !otherSources.includes(label)) {
      otherSources.push(label);
    }
  }

  return { indexFields, otherSources };
}

/** Type d'input HTML selon le champ. */
export function inputTypeForField(field) {
  if (!field) return "text";
  if (field.key === "date" || field.typeChamp === "date" || field.typeChamp === "datetime") {
    return field.typeChamp === "date" ? "date" : "datetime-local";
  }
  if (field.typeChamp === "nombre") return "number";
  return "text";
}

/** Liste déroulante pour la valeur si applicable. */
export function getValueSelectOptions(field) {
  if (!field) return null;
  if (field.key === "format") return field.options || FORMAT_FIELD_OPTIONS;
  if (field.key === "type") return field.options?.length ? field.options : null;
  if (field.key?.startsWith("champ_") && (field.typeChamp === "select" || field.typeChamp === "choix")) {
    return field.options?.length ? field.options : null;
  }
  return null;
}

/** Objet colonne compatible avec documentColumnFilters. */
export function toColumnMeta(field) {
  if (!field) return null;
  return {
    key: field.key,
    typeChamp: field.typeChamp,
    options: field.options,
    isGeo: field.isGeo || field.key?.startsWith("geo_"),
  };
}

/** Famille de filtre pour un champ de recherche avancée. */
export function getSearchFieldFilterFamily(field) {
  const column = toColumnMeta(field);
  if (!column) return FILTER_FAMILIES.TEXT;
  if (column.key === "type" && column.typeChamp === "select") {
    return FILTER_FAMILIES.SELECTION;
  }
  return getColumnFilterFamily(column);
}

export { FILTER_FAMILIES };
