/** Chemin d'emplacement — libellés uniquement, comme sur la page en_attente. */
export function formatCasierEmplacement(localite) {
  if (!localite) return "";

  const cheminArray = Array.isArray(localite.chemin) ? localite.chemin : [];
  if (cheminArray.length) {
    const fromArray = cheminArray
      .map((node) => (node.libelle || "").trim())
      .filter(Boolean)
      .join(" > ");
    if (fromArray) return fromArray;
  }

  const cheminStr = (localite.chemin_str || "").trim();
  if (!cheminStr) return "";

  // Format recherche plan geo : "Libellé (Niveau)" → on garde les libellés seuls
  return cheminStr
    .split(" > ")
    .map((part) => {
      const match = part.match(/^(.+?)\s\([^)]+\)$/);
      return (match ? match[1] : part).trim();
    })
    .filter(Boolean)
    .join(" > ");
}

/** Normalise une localité feuille en bucket contrôle qualité. */
export function normalizeBucket(localite) {
  const cheminArray = Array.isArray(localite.chemin) ? localite.chemin : [];
  return {
    id: localite.id,
    libelle: localite.libelle || "—",
    code: localite.code || "",
    niveau: localite.niveau || "",
    cheminArray,
    chemin: formatCasierEmplacement(localite),
    hierarchyKey: buildHierarchyKey(cheminArray, localite.id),
    nbParStatut: localite.nb_par_statut || {},
    nbDocuments: Number(localite.nb_documents) || 0,
  };
}

/** Clé de tri suivant l'arborescence parent → enfant. */
export function buildHierarchyKey(cheminArray, leafId) {
  const ids = (cheminArray || []).map((node) => Number(node.id));
  if (!ids.length && leafId) ids.push(Number(leafId));
  else if (leafId && ids[ids.length - 1] !== Number(leafId)) ids.push(Number(leafId));
  return ids.map((id) => String(id).padStart(10, "0")).join("/");
}

/** Trie les buckets du parent racine vers les feuilles. */
export function sortBucketsByHierarchy(buckets) {
  return [...buckets].sort((a, b) => {
    if (a.hierarchyKey !== b.hierarchyKey) {
      return a.hierarchyKey.localeCompare(b.hierarchyKey);
    }
    return a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" });
  });
}

/** Libellé du regroupement parent (chemin sans la feuille). */
export function getParentSectionLabel(bucket) {
  const chemin = bucket.cheminArray || [];
  if (chemin.length <= 1) {
    return chemin[0]?.libelle || bucket.libelle;
  }
  return chemin
    .slice(0, -1)
    .map((node) => node.libelle)
    .join(" › ");
}

/** Regroupe les buckets par branche parente (ordre hiérarchique). */
export function groupBucketsByParent(buckets) {
  const sorted = sortBucketsByHierarchy(buckets);
  const groups = [];

  for (const bucket of sorted) {
    const chemin = bucket.cheminArray || [];
    const parentNodes = chemin.length > 1 ? chemin.slice(0, -1) : chemin.slice(0, 1);
    const groupKey = parentNodes.map((node) => node.id).join("/") || `leaf-${bucket.id}`;
    const parentLabel = getParentSectionLabel(bucket);

    const last = groups[groups.length - 1];
    if (last && last.key === groupKey) {
      last.buckets.push(bucket);
    } else {
      groups.push({
        key: groupKey,
        parentLabel,
        parentPath: parentNodes,
        buckets: [bucket],
      });
    }
  }

  return groups;
}

/** Prochain casier (après celui-ci) ayant encore des documents pour le statut. */
export function getNextCasierWithDocuments(casiers, currentCasierId) {
  const sorted = sortBucketsByHierarchy(
    casiers.map((item) => (item.hierarchyKey != null ? item : normalizeBucket(item)))
  );
  const idx = sorted.findIndex((c) => Number(c.id) === Number(currentCasierId));
  if (idx < 0) return null;
  for (let i = idx + 1; i < sorted.length; i++) {
    if ((sorted[i].nbDocuments || 0) > 0) return sorted[i];
  }
  return null;
}

/**
 * Casiers candidats après le courant, ordre API (arborescence) puis boucle au début.
 * Permet de trouver un lot suivant même si le casier actuel est le dernier de la liste.
 */
export function getOrderedNextCasiers(casiers, currentCasierId) {
  const currentId = Number(currentCasierId);
  const list = Array.isArray(casiers) ? casiers : [];
  const currentIdx = list.findIndex((c) => Number(c.id) === currentId);

  if (currentIdx >= 0) {
    return [...list.slice(currentIdx + 1), ...list.slice(0, currentIdx)];
  }
  return list.filter((c) => Number(c.id) !== currentId);
}

/** Filtre les buckets descendants d'un nœud sélectionné (recherche plan geo). */
export function filterBucketsByBranch(buckets, branchId) {
  if (!branchId) return buckets;
  const id = Number(branchId);
  return buckets.filter(
    (bucket) =>
      Number(bucket.id) === id ||
      (bucket.cheminArray || []).some((node) => Number(node.id) === id)
  );
}
