/**
 * Utilitaires des filtres personnalisés par colonne (style Odoo).
 *
 * Rôle : centraliser les opérateurs, les familles de types (texte, nombre, date, sélection)
 * et les helpers utilisés par DocumentColumnFilterBar et les listes de documents.
 *
 * Format API attendu côté backend :
 * - Colonnes fixes : filter_localite_op, filter_localite, filter_type, filter_format, filter_date (+ _to si « Entre »)
 * - Niveaux géographiques : filter_geo_<ordre>_op, filter_geo_<ordre>
 * - Champs dynamiques : champ_<id>_op, champ_<id>, champ_<id>_to
 */

/** Familles de type pour déterminer les opérateurs disponibles. */
export const FILTER_FAMILIES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECTION: "selection",
};

export const TEXT_OPERATORS = [
  { id: "contains", label: "Contient" },
  { id: "not_contains", label: "Ne contient pas" },
  { id: "eq", label: "Est égal à" },
  { id: "neq", label: "Est différent de" },
  { id: "startswith", label: "Commence par" },
  { id: "endswith", label: "Se termine par" },
];

export const NUMBER_OPERATORS = [
  { id: "eq", label: "Est égal à" },
  { id: "neq", label: "Est différent de" },
  { id: "gt", label: "Supérieur à" },
  { id: "gte", label: "Supérieur ou égal à" },
  { id: "lt", label: "Inférieur à" },
  { id: "lte", label: "Inférieur ou égal à" },
  { id: "between", label: "Entre" },
];

export const DATE_OPERATORS = [
  { id: "eq", label: "Est égal à" },
  { id: "before", label: "Avant" },
  { id: "before_eq", label: "Avant ou égal" },
  { id: "after", label: "Après" },
  { id: "after_eq", label: "Après ou égal" },
  { id: "between", label: "Entre" },
];

export const SELECTION_OPERATORS = [
  { id: "eq", label: "Est égal à" },
  { id: "neq", label: "Est différent de" },
  { id: "contains", label: "Contient" },
];

/** Correspondance type_champ (métadonnées) → famille de filtre. */
const CHAMP_TYPE_FAMILY = {
  texte: FILTER_FAMILIES.TEXT,
  texte_long: FILTER_FAMILIES.TEXT,
  nombre: FILTER_FAMILIES.NUMBER,
  date: FILTER_FAMILIES.DATE,
  datetime: FILTER_FAMILIES.DATE,
  select: FILTER_FAMILIES.SELECTION,
  choix: FILTER_FAMILIES.SELECTION,
  qr: FILTER_FAMILIES.TEXT,
  code_barre: FILTER_FAMILIES.TEXT,
};

/** Correspondance colonnes fixes du tableau → famille de filtre. */
const BASE_COLUMN_FAMILY = {
  localite: FILTER_FAMILIES.TEXT,
  type: FILTER_FAMILIES.TEXT,
  format: FILTER_FAMILIES.SELECTION,
  date: FILTER_FAMILIES.DATE,
  date_modification: FILTER_FAMILIES.DATE,
};

/** Retourne la liste d'opérateurs selon la famille (texte, nombre, date, sélection). */
export function getOperatorsForFamily(family) {
  switch (family) {
    case FILTER_FAMILIES.NUMBER:
      return NUMBER_OPERATORS;
    case FILTER_FAMILIES.DATE:
      return DATE_OPERATORS;
    case FILTER_FAMILIES.SELECTION:
      return SELECTION_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

/** Détermine la famille de filtre d'une colonne (fixe ou champ dynamique champ_<id>). */
export function getColumnFilterFamily(column) {
  if (!column) return FILTER_FAMILIES.TEXT;
  if (column.key?.startsWith("champ_")) {
    return CHAMP_TYPE_FAMILY[column.typeChamp] || FILTER_FAMILIES.TEXT;
  }
  if (column.key?.startsWith("geo_") || column.isGeo) {
    return FILTER_FAMILIES.TEXT;
  }
  return BASE_COLUMN_FAMILY[column.key] || FILTER_FAMILIES.TEXT;
}

/** Opérateur par défaut lors de l'ouverture du panneau de filtre. */
export function getDefaultOperator(family) {
  if (family === FILTER_FAMILIES.NUMBER || family === FILTER_FAMILIES.DATE) return "eq";
  if (family === FILTER_FAMILIES.SELECTION) return "eq";
  return "contains";
}

/** Libellé affiché d'un opérateur (ex. « Supérieur à »). */
export function getOperatorLabel(family, opId) {
  const op = getOperatorsForFamily(family).find((o) => o.id === opId);
  return op?.label || opId;
}

/** Texte résumé d'un filtre actif pour les pastilles sous le bouton. */
export function formatColumnFilterSummary(column, filter) {
  if (!column || !isColumnFilterActive(filter)) return "";
  const family = getColumnFilterFamily(column);
  const opLabel = getOperatorLabel(family, filter.op).toLowerCase();
  const val = String(filter.value).trim();
  if (filter.op === "between") {
    return `${opLabel} ${val} et ${String(filter.valueTo).trim()}`;
  }
  return `${opLabel} « ${val} »`;
}

/** État vide d'un filtre colonne { op, value, valueTo }. */
export function emptyColumnFilter(family = FILTER_FAMILIES.TEXT) {
  return { op: getDefaultOperator(family), value: "", valueTo: "" };
}

/** Indique si un filtre colonne a une valeur exploitable (y compris borne « À » pour Entre). */
export function isColumnFilterActive(filter) {
  if (!filter) return false;
  const v = String(filter.value ?? "").trim();
  if (filter.op === "between") {
    return Boolean(v && String(filter.valueTo ?? "").trim());
  }
  return Boolean(v);
}

/** Au moins un filtre colonne est actif dans l'objet columnFilters. */
export function hasColumnFilterValues(columnFilters = {}) {
  return Object.values(columnFilters).some(isColumnFilterActive);
}

/** Retire les filtres sur les champs dynamiques (champ_*) — ex. au changement de type document. */
export function clearChampColumnFilters(columnFilters = {}) {
  const next = { ...columnFilters };
  Object.keys(next).forEach((key) => {
    if (key.startsWith("champ_")) delete next[key];
  });
  return next;
}

/** Prépare les filtres colonne pour envoi API (nettoyage des entrées vides). */
export function serializeColumnFilters(columnFilters = {}) {
  const payload = {};
  Object.entries(columnFilters).forEach(([key, filter]) => {
    if (!isColumnFilterActive(filter)) return;
    payload[key] = {
      op: filter.op,
      value: String(filter.value).trim(),
      ...(filter.op === "between" ? { valueTo: String(filter.valueTo).trim() } : {}),
    };
  });
  return payload;
}
