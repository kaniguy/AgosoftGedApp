import { getApiUrl, getHeaders, getMultipartHeaders, apiFetch } from "./api";
import { fetchDocumentFileBlob } from "./documentLocalite.service";

function mapListItem(lot) {
  return {
    id: String(lot.id),
    localiteId: lot.localite,
    localiteLibelle: lot.localite_libelle || "",
    localiteCheminStr: lot.localite_chemin_str || "",
    selectedTypeId: String(lot.type_document || ""),
    typeLibelle: lot.type_document_libelle || "",
    utilisateurId: lot.utilisateur ?? null,
    utilisateurNom: lot.utilisateur_nom || "",
    batchActiveIndex: lot.index_actif ?? 0,
    totalCount: lot.total_count ?? 0,
    pendingCount: lot.pending_count ?? lot.total_count ?? 0,
    updatedAt: lot.date_modification ? new Date(lot.date_modification).getTime() : null,
    createdAt: lot.date_creation ? new Date(lot.date_creation).getTime() : null,
    source: "server",
  };
}

function mapDetailToDraft(lot, filesByClientId) {
  const items = (lot.items || []).map((item) => {
    const clientId = item.identifiant_client;
    const file = filesByClientId[clientId] || null;
    const fichierUrl = item.fichier_url || null;
    return {
      id: clientId,
      name: item.nom_fichier || "document.pdf",
      fieldValues: item.field_values || {},
      zoneOverrides: item.zone_overrides || {},
      status: "draft",
      file,
      fichierUrl,
    };
  });

  return {
    id: String(lot.id),
    localiteId: lot.localite,
    localiteLibelle: lot.localite_libelle || "",
    localiteCheminStr: lot.localite_chemin_str || "",
    selectedTypeId: String(lot.type_document || ""),
    typeLibelle: lot.type_document_libelle || "",
    batchActiveIndex: lot.index_actif ?? 0,
    items,
    updatedAt: lot.date_modification ? new Date(lot.date_modification).getTime() : null,
    createdAt: lot.date_creation ? new Date(lot.date_creation).getTime() : null,
    source: "server",
  };
}

export async function listServerRattachementDrafts() {
  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/lots-brouillon/`, {
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const message = data?.detail || "Impossible de charger les brouillons.";
    throw new Error(typeof message === "string" ? message : "Impossible de charger les brouillons.");
  }
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map(mapListItem).filter((d) => d.pendingCount > 0);
}

export async function downloadDraftItemFile(item) {
  const url = item?.fichierUrl || item?.fichier_url;
  if (!url) return null;
  try {
    const { blob } = await fetchDocumentFileBlob(url);
    return new File([blob], item.name || item.nom_fichier || "document.pdf", {
      type: blob.type || "application/pdf",
    });
  } catch {
    return null;
  }
}

async function fetchDraftItemFiles(items, clientIdsToDownload) {
  const filesByClientId = {};
  const ids = clientIdsToDownload?.length
    ? clientIdsToDownload
    : (items || []).map((item) => item.identifiant_client);

  for (const item of items || []) {
    if (!ids.includes(item.identifiant_client) || !item.fichier_url) continue;
    const file = await downloadDraftItemFile({
      fichierUrl: item.fichier_url,
      name: item.nom_fichier,
    });
    if (file) filesByClientId[item.identifiant_client] = file;
  }
  return filesByClientId;
}

export async function getServerRattachementDraft(draftId, { downloadClientIds = null } = {}) {
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/lots-brouillon/${draftId}/`,
    { headers: getHeaders() }
  );
  const lot = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = lot?.detail || "Brouillon introuvable.";
    throw new Error(typeof message === "string" ? message : "Brouillon introuvable.");
  }

  const idsToDownload =
    downloadClientIds === null
      ? (lot.items || []).map((item) => item.identifiant_client)
      : downloadClientIds;

  const filesByClientId = await fetchDraftItemFiles(lot.items, idsToDownload);
  return mapDetailToDraft(lot, filesByClientId);
}

export async function syncServerRattachementDraft(snapshot, { uploadedClientIds = new Set() } = {}) {
  const formData = new FormData();
  if (snapshot.id && /^\d+$/.test(String(snapshot.id))) {
    formData.append("lot_id", String(snapshot.id));
  }
  formData.append("localite_id", String(snapshot.localiteId));
  formData.append("type_document_id", String(snapshot.selectedTypeId));
  formData.append("batch_active_index", String(snapshot.batchActiveIndex ?? 0));

  const itemsPayload = (snapshot.items || []).map((item, ordre) => {
    const hasLocalFile = item.file instanceof Blob;
    const alreadyUploaded = uploadedClientIds.has(item.id);
    const needsUpload = hasLocalFile && !alreadyUploaded;
    return {
      client_id: item.id,
      name: item.name || "document.pdf",
      ordre,
      field_values: item.fieldValues || {},
      zone_overrides: item.zoneOverrides || {},
      upload_file: needsUpload,
    };
  });

  formData.append("items", JSON.stringify(itemsPayload));

  for (const item of snapshot.items || []) {
    if (!(item.file instanceof Blob)) continue;
    if (uploadedClientIds.has(item.id)) continue;
    formData.append(`file_${item.id}`, item.file, item.name || "document.pdf");
  }

  const res = await apiFetch(`${getApiUrl()}/api/gestion-documentaire/lots-brouillon/sync/`, {
    method: "POST",
    headers: getMultipartHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.detail ||
      data?.items?.[0] ||
      Object.values(data || {})
        .flat()
        .find(Boolean) ||
      "Synchronisation du brouillon impossible.";
    throw new Error(typeof message === "string" ? message : "Synchronisation impossible.");
  }

  if (data.deleted) return null;

  const newUploaded = new Set(uploadedClientIds);
  for (const item of snapshot.items || []) {
    if (item.file instanceof Blob) newUploaded.add(item.id);
  }

  return {
    id: String(data.id),
    uploadedClientIds: newUploaded,
  };
}

export async function deleteServerRattachementDraft(draftId) {
  if (!draftId || !/^\d+$/.test(String(draftId))) return;
  const res = await apiFetch(
    `${getApiUrl()}/api/gestion-documentaire/lots-brouillon/${draftId}/`,
    { method: "DELETE", headers: getHeaders() }
  );
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Suppression impossible.");
  }
}

export async function findServerRattachementDraftForLocalite(localiteId) {
  const drafts = await listServerRattachementDrafts();
  return drafts.find((d) => Number(d.localiteId) === Number(localiteId)) || null;
}
