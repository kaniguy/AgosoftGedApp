/**
 * Brouillons de rattachement — synchronisation serveur (multi-postes)
 * avec repli IndexedDB hors ligne.
 */

import {
  deleteServerRattachementDraft,
  findServerRattachementDraftForLocalite,
  getServerRattachementDraft,
  listServerRattachementDrafts,
  syncServerRattachementDraft,
} from "../services/rattachementDraft.service";
import { getStoredUser } from "./permissions";

const DB_NAME = "ged-rattachement-drafts";
const DB_VERSION = 1;
const STORE = "drafts";

export const RATTACHEMENT_DRAFTS_UPDATED = "rattachement-drafts-updated";

function notifyDraftsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RATTACHEMENT_DRAFTS_UPDATED));
  }
}

export function getDraftUserKey() {
  const user = getStoredUser();
  if (!user) return null;
  return String(user.id ?? user.username ?? user.email ?? "");
}

function isServerDraftId(draftId) {
  return draftId && /^\d+$/.test(String(draftId));
}

// --- IndexedDB (repli local) ---

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_user", "userKey", { unique: false });
      }
    };
  });
}

function blobToFile(blob, name) {
  if (!blob) return null;
  if (blob instanceof File) return blob;
  return new File([blob], name || "document.pdf", {
    type: blob.type || "application/pdf",
  });
}

async function saveLocalDraft(payload) {
  const userKey = getDraftUserKey();
  if (!userKey) return null;

  const items = (payload.items || []).map((item) => ({
    id: item.id,
    name: item.name || "document.pdf",
    fieldValues: item.fieldValues || {},
    zoneOverrides: item.zoneOverrides || {},
    status: item.status || "draft",
    file: item.file instanceof Blob ? item.file : null,
  }));

  const pendingItems = items.filter((i) => i.status !== "submitted" && i.file);
  if (!pendingItems.length) {
    if (payload.id) await deleteLocalDraft(payload.id);
    return null;
  }

  const now = Date.now();
  const draft = {
    id: payload.id || `local-${now}`,
    userKey,
    localiteId: Number(payload.localiteId),
    localiteLibelle: payload.localiteLibelle || "",
    localiteCheminStr: payload.localiteCheminStr || "",
    selectedTypeId: String(payload.selectedTypeId || ""),
    typeLibelle: payload.typeLibelle || "",
    batchActiveIndex: payload.batchActiveIndex ?? 0,
    items,
    createdAt: payload.createdAt || now,
    updatedAt: now,
    source: "local",
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return draft.id;
}

async function getLocalDraft(draftId) {
  const userKey = getDraftUserKey();
  if (!userKey || !draftId) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(draftId);
    request.onsuccess = () => {
      const draft = request.result;
      if (!draft || draft.userKey !== userKey) {
        resolve(null);
        return;
      }
      resolve({
        ...draft,
        items: (draft.items || []).map((item) => ({
          ...item,
          file: blobToFile(item.file, item.name),
        })),
      });
    };
    request.onerror = () => reject(request.error);
  });
}

async function listLocalDrafts() {
  const userKey = getDraftUserKey();
  if (!userKey) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).index("by_user").getAll(userKey);
    request.onsuccess = () => {
      const drafts = (request.result || [])
        .map((draft) => {
          const items = draft.items || [];
          const pendingCount = items.filter((i) => i.status !== "submitted").length;
          return {
            id: draft.id,
            localiteId: draft.localiteId,
            localiteLibelle: draft.localiteLibelle,
            localiteCheminStr: draft.localiteCheminStr || "",
            selectedTypeId: draft.selectedTypeId,
            typeLibelle: draft.typeLibelle || "",
            batchActiveIndex: draft.batchActiveIndex ?? 0,
            totalCount: items.length,
            pendingCount,
            updatedAt: draft.updatedAt,
            createdAt: draft.createdAt,
            source: "local",
          };
        })
        .filter((d) => d.pendingCount > 0);
      resolve(drafts);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteLocalDraft(draftId) {
  if (!draftId) return;
  const userKey = getDraftUserKey();
  if (!userKey) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(draftId);
    getReq.onsuccess = () => {
      const draft = getReq.result;
      if (draft && draft.userKey === userKey) store.delete(draftId);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteLocalDraftsForLocalite(localiteId) {
  const drafts = await listLocalDrafts();
  for (const d of drafts) {
    if (Number(d.localiteId) === Number(localiteId)) {
      await deleteLocalDraft(d.id);
    }
  }
}

// --- API publique ---

export async function listRattachementDrafts() {
  try {
    return await listServerRattachementDrafts();
  } catch {
    const local = await listLocalDrafts();
    return local.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
}

export async function getRattachementDraft(draftId, options) {
  if (isServerDraftId(draftId)) {
    try {
      return await getServerRattachementDraft(draftId, options);
    } catch {
      return null;
    }
  }
  return getLocalDraft(draftId);
}

export async function findRattachementDraftForLocalite(localiteId) {
  try {
    return await findServerRattachementDraftForLocalite(localiteId);
  } catch {
    const local = await listLocalDrafts();
    return local.find((d) => Number(d.localiteId) === Number(localiteId)) || null;
  }
}

export async function saveRattachementDraft(payload, { uploadedClientIds } = {}) {
  try {
    const result = await syncServerRattachementDraft(payload, { uploadedClientIds });
    await deleteLocalDraftsForLocalite(payload.localiteId);
    notifyDraftsUpdated();
    return result;
  } catch {
    const localId = await saveLocalDraft(payload);
    notifyDraftsUpdated();
    return localId ? { id: localId, uploadedClientIds: new Set() } : null;
  }
}

export async function deleteRattachementDraft(draftId) {
  if (isServerDraftId(draftId)) {
    try {
      await deleteServerRattachementDraft(draftId);
    } catch {
      // ignore
    }
  }
  await deleteLocalDraft(draftId);
  notifyDraftsUpdated();
}

export function buildRattachementDraftSnapshot({
  draftId,
  createdAt,
  localite,
  selectedTypeId,
  typeLibelle,
  batchActiveIndex,
  batchItems,
  fichier,
  fieldValues,
  zoneOverrides,
  getPersistedBatchItems,
}) {
  if (!localite?.id || !selectedTypeId) return null;

  let items = [];
  if (batchItems?.length && getPersistedBatchItems) {
    items = getPersistedBatchItems().filter((item) => item.status !== "submitted" && item.file);
  } else if (fichier) {
    items = [
      {
        id: `single-${localite.id}`,
        file: fichier,
        name: fichier.name || "document.pdf",
        fieldValues: { ...fieldValues },
        zoneOverrides: { ...zoneOverrides },
        status: "draft",
      },
    ];
  }

  if (!items.length) return null;

  const cheminStr =
    localite.chemin_str ||
    (Array.isArray(localite.chemin) ? localite.chemin.map((c) => c.libelle).join(" > ") : "");

  return {
    id: draftId,
    createdAt,
    localiteId: localite.id,
    localiteLibelle: localite.libelle || "",
    localiteCheminStr: cheminStr,
    selectedTypeId,
    typeLibelle,
    batchActiveIndex: batchActiveIndex ?? 0,
    items,
  };
}

/** Après restauration depuis le serveur, les fichiers sont déjà en ligne. */
export function buildUploadedClientIdsFromDraft(draft) {
  const ids = new Set();
  for (const item of draft?.items || []) {
    if (item.id && item.file) ids.add(item.id);
  }
  return ids;
}
