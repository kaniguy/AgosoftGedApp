"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  buildRattachementDraftSnapshot,
  buildUploadedClientIdsFromDraft,
  deleteRattachementDraft,
  getRattachementDraft,
  saveRattachementDraft,
} from "../utils/rattachementDraftStore";
import { downloadDraftItemFile } from "../services/rattachementDraft.service";

const SAVE_DEBOUNCE_MS = 1200;

/**
 * Sauvegarde automatique des brouillons de rattachement et restauration à la reprise.
 */
export function useRattachementDraftPersistence({
  enabled,
  localite,
  initialDraftId,
  selectedTypeId,
  typeLibelle,
  batchItems,
  batchActiveIndex,
  fichier,
  fieldValues,
  zoneOverrides,
  getPersistedBatchItems,
  loadChamps,
  loadBatchItemIntoWorkbench,
  setSelectedTypeId,
  setBatchItems,
  setBatchActiveIndex,
  onNotify,
}) {
  const draftIdRef = useRef(null);
  const createdAtRef = useRef(null);
  const uploadedClientIdsRef = useRef(new Set());
  const restoreStartedRef = useRef(false);
  const restoredRef = useRef(!initialDraftId);
  const restoreAttemptKeyRef = useRef(null);
  const saveTimerRef = useRef(null);

  const invalidateUploadedFiles = useCallback(
    (itemIds) => {
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      ids.filter(Boolean).forEach((id) => uploadedClientIdsRef.current.delete(id));
    },
    []
  );

  const persistNow = useCallback(async () => {
    if (!enabled || (restoreStartedRef.current && !restoredRef.current)) {
      return draftIdRef.current;
    }

    const snapshot = buildRattachementDraftSnapshot({
      draftId: draftIdRef.current,
      createdAt: createdAtRef.current,
      localite,
      selectedTypeId,
      typeLibelle,
      batchActiveIndex,
      batchItems,
      fichier,
      fieldValues,
      zoneOverrides,
      getPersistedBatchItems,
    });

    if (!snapshot) {
      if (draftIdRef.current) {
        await deleteRattachementDraft(draftIdRef.current);
        draftIdRef.current = null;
        createdAtRef.current = null;
      }
      return null;
    }

    try {
      const result = await saveRattachementDraft(snapshot, {
        uploadedClientIds: uploadedClientIdsRef.current,
      });
      if (result?.id) {
        draftIdRef.current = result.id;
        if (!createdAtRef.current) {
          createdAtRef.current = snapshot.createdAt || Date.now();
        }
      } else if (result && typeof result === "string") {
        draftIdRef.current = result;
      }
      if (result?.uploadedClientIds) {
        uploadedClientIdsRef.current = result.uploadedClientIds;
      }
      return draftIdRef.current;
    } catch {
      return draftIdRef.current;
    }
  }, [
    enabled,
    localite,
    selectedTypeId,
    typeLibelle,
    batchActiveIndex,
    batchItems,
    fichier,
    fieldValues,
    zoneOverrides,
    getPersistedBatchItems,
  ]);

  const scheduleSave = useCallback(() => {
    if (!enabled || (restoreStartedRef.current && !restoredRef.current)) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }, [enabled, persistNow]);

  const clearDraft = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (draftIdRef.current) {
      await deleteRattachementDraft(draftIdRef.current);
    }
    draftIdRef.current = null;
    createdAtRef.current = null;
    uploadedClientIdsRef.current = new Set();
    restoreAttemptKeyRef.current = null;
  }, []);

  const restoreDraft = useCallback(
    async (draftId) => {
      if (!enabled || !draftId || !localite) return false;
      restoreStartedRef.current = true;

      try {
        const draftMeta = await getRattachementDraft(draftId, { downloadClientIds: [] });
        if (!draftMeta || Number(draftMeta.localiteId) !== Number(localite.id)) {
          onNotify?.("Brouillon introuvable ou localité différente.", "error");
          restoredRef.current = true;
          return false;
        }

        const pendingItems = (draftMeta.items || []).filter((item) => item.status !== "submitted");
        if (!pendingItems.length) {
          await deleteRattachementDraft(draftMeta.id);
          restoredRef.current = true;
          return false;
        }

        const activeIndex = Math.min(
          Math.max(0, draftMeta.batchActiveIndex ?? 0),
          pendingItems.length - 1
        );
        const activeItem = pendingItems[activeIndex];

        if (!activeItem.file && activeItem.fichierUrl) {
          activeItem.file = await downloadDraftItemFile(activeItem);
        }

        if (!activeItem.file) {
          onNotify?.("Impossible de charger le fichier du document actif.", "error");
          restoredRef.current = true;
          return false;
        }

        const draft = draftMeta;

        if (draft.selectedTypeId) {
          setSelectedTypeId(String(draft.selectedTypeId));
          const seedValues = Object.entries(activeItem.fieldValues || {}).map(
            ([champ_id, valeur]) => ({
              champ_id: Number(champ_id),
              valeur: String(valeur ?? ""),
            })
          );
          await loadChamps(draft.selectedTypeId, seedValues);
        }

        draftIdRef.current = String(draft.id);
        createdAtRef.current = draft.createdAt;
        uploadedClientIdsRef.current = buildUploadedClientIdsFromDraft({
          items: pendingItems.filter((item) => item.file),
        });
        if (activeItem.file) {
          uploadedClientIdsRef.current.add(activeItem.id);
        }

        setBatchItems(pendingItems);
        setBatchActiveIndex(activeIndex);
        await loadBatchItemIntoWorkbench(activeItem);

        onNotify?.(
          `Brouillon repris — ${pendingItems.length} document${pendingItems.length > 1 ? "s" : ""} en attente de soumission.`,
          "success"
        );
        restoredRef.current = true;
        return true;
      } catch (err) {
        onNotify?.(err.message || "Impossible de charger le brouillon", "error");
        restoredRef.current = true;
        return false;
      }
    },
    [
      enabled,
      localite,
      loadChamps,
      loadBatchItemIntoWorkbench,
      setSelectedTypeId,
      setBatchItems,
      setBatchActiveIndex,
      onNotify,
    ]
  );

  const restoreDraftRef = useRef(restoreDraft);
  restoreDraftRef.current = restoreDraft;

  useEffect(() => {
    if (!enabled || !initialDraftId || !localite?.id) {
      restoredRef.current = !initialDraftId;
      return;
    }

    const attemptKey = `${localite.id}-${initialDraftId}`;
    if (restoreAttemptKeyRef.current === attemptKey) return;

    restoreAttemptKeyRef.current = attemptKey;
    restoredRef.current = false;
    restoreStartedRef.current = false;

    restoreDraftRef.current(initialDraftId);
  }, [enabled, initialDraftId, localite?.id]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    scheduleSave,
    selectedTypeId,
    batchItems,
    batchActiveIndex,
    fichier,
    fieldValues,
    zoneOverrides,
  ]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    []
  );

  return {
    draftIdRef,
    persistNow,
    clearDraft,
    restoreDraft,
    invalidateUploadedFiles,
  };
}
