/**
 * Colonnes géographiques pour les listes de documents (niveaux + feuille).
 */

export function getCheminEntry(doc, niveauOrdre) {
  return (doc.localite_chemin || []).find((c) => c.niveau_ordre === niveauOrdre);
}

export function getLeafLocaliteLabel(doc) {
  const chemin = doc.localite_chemin || [];
  if (chemin.length) return chemin[chemin.length - 1].libelle;
  return doc.localite_libelle || "—";
}

/** Colonnes des niveaux intermédiaires + dernier niveau (localité). */
export function buildGeoColumns(structures = []) {
  const sorted = [...structures].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const ancestorLevels = sorted.length > 1 ? sorted.slice(0, -1) : [];
  const lastLevel = sorted[sorted.length - 1];

  const cols = ancestorLevels.map((s) => ({
    key: `geo_${s.ordre}`,
    label: s.libelle,
    niveauOrdre: s.ordre,
    isGeo: true,
  }));

  cols.push({
    key: "localite",
    label: lastLevel?.libelle || "Localité",
    isGeo: true,
    isLeaf: true,
  });

  return cols;
}

/**
 * Colonnes de base du tableau documents : géographie + type (optionnel) + format + date.
 */
export function buildDocumentTableBaseColumns(structures = [], { includeType = true } = {}) {
  const cols = buildGeoColumns(structures);
  if (includeType) {
    cols.push({ key: "type", label: "Type de document" });
  }
  cols.push(
    { key: "format", label: "Format" },
    { key: "date", label: "Date d'enregistrement" }
  );
  return cols;
}
