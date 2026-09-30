/**
 * Historique annuler / rétablir pour le workbench document (PDF + zones + annotations).
 */
import { useCallback, useMemo, useReducer } from "react";
import { mimeFromFilename } from "@/utils/documentFileTypes";

const MAX_ENTRIES = 40;

export async function clonePdfFile(file) {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  return new File([buffer], file.name, {
    type: file.type || mimeFromFilename(file.name) || "application/octet-stream",
    lastModified: Date.now(),
  });
}

export function cloneZoneOverrides(overrides = {}) {
  return JSON.parse(JSON.stringify(overrides));
}

export function cloneAnnotations(annotations = []) {
  return JSON.parse(JSON.stringify(annotations || []));
}

export async function createWorkbenchSnapshot({
  fichier,
  zoneOverrides = {},
  currentPage = 1,
  annotations = [],
  cloneFile = true,
}) {
  return {
    fichier: fichier ? (cloneFile ? await clonePdfFile(fichier) : fichier) : null,
    zoneOverrides: cloneZoneOverrides(zoneOverrides),
    currentPage: Math.max(1, currentPage),
    annotations: cloneAnnotations(annotations),
  };
}

function historyReducer(state, action) {
  switch (action.type) {
    case "RESET":
      return { entries: action.entries, index: action.entries.length ? action.entries.length - 1 : -1 };
    case "COMMIT": {
      const truncated = state.entries.slice(0, state.index + 1);
      const entries = [...truncated, action.snapshot].slice(-MAX_ENTRIES);
      return { entries, index: entries.length - 1 };
    }
    case "UNDO":
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };
    case "REDO":
      if (state.index >= state.entries.length - 1) return state;
      return { ...state, index: state.index + 1 };
    default:
      return state;
  }
}

export function useDocumentWorkbenchHistory() {
  const [{ entries, index }, dispatch] = useReducer(historyReducer, { entries: [], index: -1 });

  const canUndo = index > 0;
  const canRedo = index >= 0 && index < entries.length - 1;

  const resetHistory = useCallback(async (snapshot) => {
    dispatch({ type: "RESET", entries: [snapshot] });
  }, []);

  const commitSnapshot = useCallback(async (snapshotInput) => {
    const snapshot =
      snapshotInput?.fichier &&
      typeof snapshotInput.fichier.arrayBuffer === "function" &&
      Array.isArray(snapshotInput.annotations)
        ? {
            ...snapshotInput,
            annotations: cloneAnnotations(snapshotInput.annotations),
            zoneOverrides: cloneZoneOverrides(snapshotInput.zoneOverrides || {}),
          }
        : await createWorkbenchSnapshot(snapshotInput);
    dispatch({ type: "COMMIT", snapshot });
  }, []);

  const undo = useCallback(() => {
    if (index <= 0) return null;
    const nextIndex = index - 1;
    dispatch({ type: "UNDO" });
    return entries[nextIndex];
  }, [entries, index]);

  const redo = useCallback(() => {
    if (index >= entries.length - 1) return null;
    const nextIndex = index + 1;
    dispatch({ type: "REDO" });
    return entries[nextIndex];
  }, [entries, index]);

  return useMemo(
    () => ({
      canUndo,
      canRedo,
      resetHistory,
      commitSnapshot,
      undo,
      redo,
      createSnapshot: createWorkbenchSnapshot,
    }),
    [canUndo, canRedo, resetHistory, commitSnapshot, undo, redo]
  );
}
