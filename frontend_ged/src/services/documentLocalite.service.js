// Service API : documents par localité, filtres, téléchargement et aperçu fichier
import { getApiUrl, getHeaders, getMultipartHeaders, resolveMediaUrl, apiFetch } from "./api";
import { notifyControleQualiteStatsUpdated } from "../utils/controleQualiteStats";

// Envoie le document et les métadonnées saisies vers l'API de rattachement
export const createDocumentLocalite = async ({ localiteId, typeDocumentId, fichier, valeurs }) => {
  const formData = new FormData();
  formData.append("localite", String(localiteId));
  formData.append("type_document", String(typeDocumentId));
  formData.append("fichier", fichier);
  formData.append("valeurs", JSON.stringify(valeurs || []));

  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/`, {
    method: "POST",
    headers: getMultipartHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.valeurs?.[0] ||
      data?.localite?.[0] ||
      data?.fichier?.[0] ||
      data?.detail ||
      data?.non_field_errors?.[0] ||
      "Erreur lors de l'enregistrement du document";
    throw new Error(typeof message === "string" ? message : "Erreur lors de l'enregistrement");
  }
  return data;
};

function normalizeDocumentList(data) {
  if (Array.isArray(data)) return { results: data, total: data.length, offset: 0, limit: data.length, has_more: false };
  if (data && Array.isArray(data.results)) {
    return {
      results: data.results,
      total: data.total ?? data.results.length,
      offset: data.offset ?? 0,
      limit: data.limit ?? data.results.length,
      has_more: Boolean(data.has_more),
    };
  }
  return { results: [], total: 0, offset: 0, limit: 15, has_more: false };
}

export const DOCUMENT_PAGE_SIZE = 15;

/** Ajoute les filtres legacy champ_<id> (sans opérateur, « contient » côté API). */
function appendChampFilters(params, champFilters = {}) {
  Object.entries(champFilters).forEach(([champId, value]) => {
    const trimmed = String(value ?? "").trim();
    if (trimmed) params.set(`champ_${champId}`, trimmed);
  });
}

/**
 * Sérialise columnFilters vers les query params attendus par document_column_filters.py.
 * Ex. localite → filter_localite_op + filter_localite ; geo_2 → filter_geo_2_op + filter_geo_2 ; champ_5 → champ_5_op + champ_5 (+ _to si Entre).
 */
export function appendColumnFilters(params, columnFilters = {}) {
  const baseKeyMap = {
    localite: "filter_localite",
    type: "filter_type",
    format: "filter_format",
    date: "filter_date",
  };

  Object.entries(columnFilters).forEach(([key, filter]) => {
    if (!filter?.value || !String(filter.value).trim()) return;
    const op = filter.op || "contains";
    const value = String(filter.value).trim();
    let prefix = null;
    if (key.startsWith("champ_")) {
      prefix = key;
    } else if (key.startsWith("geo_")) {
      prefix = `filter_${key}`;
    } else {
      prefix = baseKeyMap[key];
    }
    if (!prefix) return;
    params.set(`${prefix}_op`, op);
    params.set(prefix, value);
    if (op === "between" && filter.valueTo) {
      params.set(`${prefix}_to`, String(filter.valueTo).trim());
    }
  });
}

// Types de documents présents (avec compteur, filtre localité optionnel)
export const getTypesAvecDocuments = async (localiteId = null, { statutQualite } = {}) => {
  const params = new URLSearchParams();
  if (localiteId) {
    params.set("localite", String(localiteId));
  }
  if (statutQualite) {
    params.set("statut_qualite", String(statutQualite));
  }
  const query = params.toString();
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/types-avec-documents/${query ? `?${query}` : ""}`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    throw new Error("Impossible de charger les types de documents");
  }
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
};

// Liste paginée globale avec filtres
function buildDocumentSearchParams({
  localiteId,
  typeDocumentId,
  typeDocumentIds,
  q,
  dateDebut,
  dateFin,
  format,
  statutQualite,
  champFilters,
  columnFilters,
  offset = 0,
  limit = DOCUMENT_PAGE_SIZE,
} = {}) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (localiteId) params.set("localite", String(localiteId));
  if (typeDocumentIds?.length) {
    params.set("type_document_in", typeDocumentIds.map(String).join(","));
  } else if (typeDocumentId) {
    params.set("type_document", String(typeDocumentId));
  }
  if (q?.trim()) params.set("q", q.trim());
  if (dateDebut) params.set("date_debut", dateDebut);
  if (dateFin) params.set("date_fin", dateFin);
  if (format) params.set("format_fichier", format);
  if (statutQualite) params.set("statut_qualite", statutQualite);
  appendChampFilters(params, champFilters);
  appendColumnFilters(params, columnFilters);
  return params;
}

export const getDocuments = async (query = {}) => {
  const params = buildDocumentSearchParams(query);
  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les documents");
  }
  const data = await res.json();
  return normalizeDocumentList(data);
};

/** Identifiants des documents correspondant aux filtres (pagination). */
export const getDocumentIds = async (query = {}) => {
  const params = buildDocumentSearchParams(query);
  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/ids/?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger la sélection des documents");
  }
  const data = await res.json();
  return normalizeDocumentList(data);
};

/** Tous les identifiants correspondant aux filtres actifs. */
export const getAllMatchingDocumentIds = async (query = {}) => {
  const ids = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await getDocumentIds({ ...query, offset, limit });
    ids.push(...res.results.map((id) => Number(id)).filter(Boolean));
    if (!res.has_more) break;
    offset += limit;
  }

  return ids;
};

/** Ajoute type document + filtres colonne aux paramètres d'une requête documents / casiers QC. */
export function appendDocumentFilterParams(params, { typeDocumentId, statutQualite, columnFilters } = {}) {
  if (statutQualite) params.set("statut_qualite", String(statutQualite));
  if (typeDocumentId) params.set("type_document", String(typeDocumentId));
  appendColumnFilters(params, columnFilters);
}

export function hasChampFilterValues(champFilters = {}) {
  return Object.values(champFilters).some((v) => String(v ?? "").trim());
}

/** Indique si au moins un filtre colonne personnalisé a une valeur renseignée. */
export function hasColumnFilterValues(columnFilters = {}) {
  return Object.values(columnFilters).some((f) => f?.value && String(f.value).trim());
}

// Identifie les champs d'index dont la valeur appliquée ne retourne aucun document
export async function findUnmatchedChampFilterIds(query) {
  const { champFilters, ...base } = query;
  if (!hasChampFilterValues(champFilters)) return [];

  const active = Object.entries(champFilters).filter(([, v]) => String(v ?? "").trim());
  const checks = await Promise.all(
    active.map(async ([champId]) => {
      const reduced = { ...champFilters };
      delete reduced[champId];
      const res = await getDocuments({
        ...base,
        champFilters: reduced,
        offset: 0,
        limit: 1,
      });
      return res.total > 0 ? String(champId) : null;
    })
  );
  return checks.filter(Boolean);
};

// Types de documents présents sur une localité (avec compteur)
export const getTypesDocumentsParLocalite = async (localiteId) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/types-par-localite/?localite=${localiteId}`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    throw new Error("Impossible de charger les types de documents");
  }
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
};

// Liste paginée des documents rattachés à une localité (filtres optionnels)
export const getDocumentsParLocalite = async (
  localiteId,
  { typeDocumentId, q, dateDebut, dateFin, format, statutQualite, champFilters, columnFilters, offset = 0, limit = DOCUMENT_PAGE_SIZE } = {}
) => {
  return getDocuments({
    localiteId,
    typeDocumentId,
    q,
    dateDebut,
    dateFin,
    format,
    statutQualite,
    champFilters,
    columnFilters,
    offset,
    limit,
  });
};

// Détail d'un document
export const getDocumentLocalite = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/${id}/`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error("Document introuvable");
  }
  return res.json();
};

function getAuthHeaders() {
  const headers = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers.Authorization = `Token ${token}`;
    }
  }
  return headers;
}

// Charge un fichier distant pour prévisualisation (avec authentification si nécessaire)
export const fetchDocumentFileBlob = async (fileUrl) => {
  const url = resolveMediaUrl(fileUrl);
  if (!url) {
    throw new Error("Fichier indisponible");
  }

  const res = await apiFetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error("Impossible de charger l'aperçu du document");
  }

  const blob = await res.blob();
  return { blob, blobUrl: URL.createObjectURL(blob) };
};

// Télécharge un fichier brut via son URL média (brouillons, versions archivées…)
export const downloadDocumentFile = async (fileUrl, filename = "document") => {
  const url = resolveMediaUrl(fileUrl);
  if (!url) {
    throw new Error("Fichier indisponible");
  }

  const bustUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const res = await apiFetch(bustUrl, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error("Impossible de télécharger le fichier");
  }

  const blob = await res.blob();
  triggerBlobDownload(blob, filename);
};

function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

/** Télécharge un document avec annotations fusionnées (version courante ou archivée). */
export const downloadDocumentLocalite = async (doc, filename = "document", { versionId } = {}) => {
  if (!doc?.id) {
    throw new Error("Document invalide");
  }

  let url = `${getApiUrl()}/api/gestion-documentaire/documents/${doc.id}/telecharger/`;
  if (versionId != null) {
    url += `?version_id=${encodeURIComponent(versionId)}`;
  }

  const res = await apiFetch(url, { headers: getAuthHeaders() });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Impossible de télécharger le fichier"
    );
  }

  const blob = await res.blob();
  const headerName = parseFilenameFromDisposition(res.headers.get("Content-Disposition"));
  triggerBlobDownload(blob, headerName || filename);
};

function parseFilenameFromDisposition(header) {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain ? plain[1].trim() : null;
}

/** Télécharge une sélection de documents dans une archive RAR (ou ZIP). */
export const downloadDocumentsArchive = async (documentIds) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/telecharger-archive/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ids: documentIds }),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Impossible de créer l'archive"
    );
  }

  const blob = await res.blob();
  const filename =
    parseFilenameFromDisposition(res.headers.get("Content-Disposition")) ||
    `documents-${new Date().toISOString().slice(0, 10)}.rar`;
  triggerBlobDownload(blob, filename);
  return { filename };
};

// Met à jour un document (métadonnées et/ou fichier)
export const updateDocumentLocalite = async (
  id,
  { typeDocumentId, fichier, valeurs, annotations, saveMode }
) => {
  const formData = new FormData();
  if (typeDocumentId) formData.append("type_document", String(typeDocumentId));
  if (fichier) formData.append("fichier", fichier);
  if (valeurs) formData.append("valeurs", JSON.stringify(valeurs));
  if (annotations !== undefined) formData.append("annotations", JSON.stringify(annotations));
  if (saveMode) formData.append("save_mode", saveMode);

  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/${id}/`, {
    method: "PATCH",
    headers: getMultipartHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.valeurs?.[0] ||
      data?.type_document?.[0] ||
      data?.fichier?.[0] ||
      data?.detail ||
      "Erreur lors de la modification";
    throw new Error(typeof message === "string" ? message : "Erreur lors de la modification");
  }
  return data;
};

export const getDocumentVersions = async (id) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${id}/versions/`,
    { headers: getHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || "Impossible de charger l'historique des versions.");
  }
  return data;
};

// Soumet un document au contrôle qualité (brouillon ou rejeté → en attente)
export const soumettreControleQualite = async (id, { fichier, valeurs } = {}) => {
  const formData = new FormData();
  if (fichier) formData.append("fichier", fichier);
  if (valeurs) formData.append("valeurs", JSON.stringify(valeurs));

  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${id}/controle-qualite/soumettre/`,
    {
      method: "POST",
      headers: getMultipartHeaders(),
      body: formData,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.non_field_errors?.[0] ||
      data?.valeurs?.[0] ||
      data?.fichier?.[0] ||
      data?.detail ||
      "Erreur lors de la soumission";
    throw new Error(typeof message === "string" ? message : "Erreur lors de la soumission");
  }
  notifyControleQualiteStatsUpdated();
  return data;
};

// Valide un document après contrôle qualité
export const validerControleQualite = async (id, { fichier, valeurs } = {}) => {
  const formData = new FormData();
  if (fichier) formData.append("fichier", fichier);
  if (valeurs) formData.append("valeurs", JSON.stringify(valeurs));

  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${id}/controle-qualite/valider/`,
    {
      method: "POST",
      headers: getMultipartHeaders(),
      body: formData,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.valeurs?.[0] ||
      data?.fichier?.[0] ||
      data?.detail ||
      "Erreur lors de la validation";
    throw new Error(typeof message === "string" ? message : "Erreur lors de la validation");
  }
  notifyControleQualiteStatsUpdated();
  return data;
};

// Rejette un document après contrôle qualité
export const rejeterControleQualite = async (id, { motifRejet = "" } = {}) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/documents/${id}/controle-qualite/rejeter/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ motif_rejet: motifRejet }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : "Erreur lors du rejet");
  }
  notifyControleQualiteStatsUpdated();
  return data;
};

// Supprime un document
export const deleteDocumentLocalite = async (id) => {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/documents/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error("Impossible de supprimer le document");
  }
  return { success: true };
};

// Supprime plusieurs documents (appels unitaires)
export const deleteDocumentsLocalite = async (ids = []) => {
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  if (!uniqueIds.length) return { deleted: 0, failed: 0 };

  const results = await Promise.allSettled(uniqueIds.map((id) => deleteDocumentLocalite(id)));
  const failed = results.filter((result) => result.status === "rejected").length;
  const deleted = uniqueIds.length - failed;

  if (!deleted) {
    throw new Error("Impossible de supprimer les documents sélectionnés");
  }
  if (failed) {
    throw new Error(
      `${deleted} document${deleted > 1 ? "s" : ""} supprimé${deleted > 1 ? "s" : ""}, ${failed} échec${failed > 1 ? "s" : ""}`
    );
  }
  return { deleted, failed };
};
