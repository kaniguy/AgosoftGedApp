/**
 * DocumentRattachementPanel — Panneau principal de rattachement et de modification
 * d'un document sur une localité du plan géographique.
 *
 * Mode plein écran (fullPage) : layout Dockmee 3 panneaux (pages | aperçu | index),
 * identique au contrôle qualité.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTypeDocuments } from "../../../services/typeDocument.service";
import { getChampsDocuments } from "../../../services/champsDocument.service";
import {
  createDocumentLocalite,
  fetchDocumentFileBlob,
  getDocumentVersions,
  soumettreControleQualite,
  updateDocumentLocalite,
} from "../../../services/documentLocalite.service";
import { extractDocumentFields } from "../../../services/ocr.service";
import DocumentPreview from "./DocumentPreview";
import DocumentChampsForm from "./DocumentChampsForm";
import DocumentAnalysisLoading from "./DocumentAnalysisLoading";
import WorkbenchUndoRedoButtons from "./WorkbenchUndoRedoButtons";
import ResizableSplitPane from "./ResizableSplitPane";
import { useDocumentWorkbenchHistory } from "@/hooks/useDocumentWorkbenchHistory";
import { useRattachementDraftPersistence } from "@/hooks/useRattachementDraftPersistence";
import { downloadDraftItemFile } from "../../../services/rattachementDraft.service";
import { buildRattachementDraftSnapshot } from "../../../utils/rattachementDraftStore";
import { useRattachementLeaveGuardOptional } from "./RattachementLeaveGuard";
import AddPagesFromFileModal from "../../controle_qualite/AddPagesFromFileModal";
import PageCropModal from "../../controle_qualite/PageCropModal";
import DocumentSaveModeModal from "./DocumentSaveModeModal";
import { DocumentVersionsPanel, DocumentVersionPreviewModal } from "./DocumentVersionsModal";
import WorkbenchIconRail, { RailIcon } from "./WorkbenchIconRail";
import SignaturesManagePanel from "./SignaturesManagePanel";
import StampsManagePanel from "./StampsManagePanel";
import NotesManagePanel from "./NotesManagePanel";
import AnnotationToolbar from "./AnnotationToolbar";
import {
  ANNOTATION_COLORS,
  ANNOTATION_TOOLS,
  normalizeAnnotations,
  STAMP_DEFAULT_COLORS,
} from "@/utils/pdfAnnotationUtils";
import {
  listUserSignatures,
} from "../../../services/userSignature.service";
import { apiFetch, resolveMediaUrl } from "../../../services/api";
import { normalizeDatetimeLocalValue, buildValeursPayload } from "../../../utils/dateFormat";
import {
  appendSelectedPagesToPdf,
  cropPdfPage,
  getPdfPageCount,
  normalizeToPdfFile,
  removePageFromPdf,
  rotatePdfPage,
} from "@/utils/pdfPageUtils";
import {
  champHasCaptureZone,
  countZonesByPage,
  filterZonesForPage,
  mergeChampsWithZoneOverrides,
  zoneOverridesToPayload,
} from "@/utils/captureZoneUtils";
import { hasPermission, PERMISSIONS } from "@/utils/permissions";

const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf";

function isPdfFile(file) {
  return file?.type === "application/pdf" || (file?.name || "").toLowerCase().endsWith(".pdf");
}

function SidebarToolButton({ title, onClick, disabled, children, danger = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition disabled:opacity-35 disabled:cursor-not-allowed ${
        danger
          ? "hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200"
      }`}
    >
      {children}
    </button>
  );
}

function buildEmptyFieldValues(champList) {
  const values = {};
  (champList || []).forEach((champ) => {
    values[champ.id] = "";
  });
  return values;
}

function isAcceptedImportFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.(pdf|jpe?g|png|webp|gif)$/.test(name)
  );
}

function createBatchItem(file, champList, extra = {}) {
  return {
    id: extra.id || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    name: file?.name || "document.pdf",
    fieldValues: extra.fieldValues || buildEmptyFieldValues(champList),
    zoneOverrides: extra.zoneOverrides || {},
    status: extra.status || "draft",
    errorMessage: extra.errorMessage || null,
  };
}

function validateItemFieldValues(item, champList) {
  const errors = {};
  (champList || []).forEach((champ) => {
    if (champ.obligatoire && !String(item.fieldValues?.[champ.id] ?? "").trim()) {
      errors[champ.id] = "Ce champ est obligatoire";
    }
  });
  return errors;
}

function isItemReady(item, champList) {
  return Object.keys(validateItemFieldValues(item, champList)).length === 0;
}

export default function DocumentRattachementPanel({
  localite,
  documentToEdit = null,
  fullPage = false,
  initialDraftId = null,
  enableAppendDocuments = false,
  onClose,
  onSaved,
  onNotify,
}) {
  const isEditMode = Boolean(documentToEdit);
  const fileInputRef = useRef(null);
  const formPanelRef = useRef(null);
  const addPagesInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const batchImportInputRef = useRef(null);
  const ocrRequestIdRef = useRef(0);
  const ocrAbortRef = useRef(null);
  const importHintKeyRef = useRef(null);
  const markActiveItemForUploadRef = useRef(() => {});
  const initialEditSnapshotRef = useRef(null);
  const workbenchHistory = useDocumentWorkbenchHistory();
  const { resetHistory, createSnapshot } = workbenchHistory;

  const [typeDocuments, setTypeDocuments] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [champs, setChamps] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingChamps, setLoadingChamps] = useState(false);
  const [importedFile, setImportedFile] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileModified, setFileModified] = useState(false);
  const [filePreviewKey, setFilePreviewKey] = useState(0);
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const [pendingPdfQueue, setPendingPdfQueue] = useState([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrFilledCount, setOcrFilledCount] = useState(0);
  const [filledChampIds, setFilledChampIds] = useState([]);
  const [activeChampId, setActiveChampId] = useState(null);
  const [focusPageIndex, setFocusPageIndex] = useState(null);
  const [zoneAdjustMode, setZoneAdjustMode] = useState(false);
  const [showZonesMode, setShowZonesMode] = useState(false);
  const [zoneOverrides, setZoneOverrides] = useState({});
  const [zonesDirty, setZonesDirty] = useState(false);
  const [formPanelWidth, setFormPanelWidth] = useState(0);
  const [batchItems, setBatchItems] = useState(null);
  const [batchActiveIndex, setBatchActiveIndex] = useState(0);
  const [batchSubmitProgress, setBatchSubmitProgress] = useState(null);
  const [leftSidebarTab, setLeftSidebarTab] = useState("pages");
  const [annotations, setAnnotations] = useState([]);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const fichierRef = useRef(fichier);
  fichierRef.current = fichier;
  const [annotationTool, setAnnotationTool] = useState(ANNOTATION_TOOLS.SELECT);
  const [annotationColor, setAnnotationColor] = useState(ANNOTATION_COLORS.yellow);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [showSaveModeModal, setShowSaveModeModal] = useState(false);
  const [documentVersions, setDocumentVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionCourante, setVersionCourante] = useState(1);
  const [rightRailPanel, setRightRailPanel] = useState("index");
  const [userSignatures, setUserSignatures] = useState([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState(null);
  const [selectedSignatureDataUrl, setSelectedSignatureDataUrl] = useState(null);
  const [signatureUsername, setSignatureUsername] = useState("");
  const [selectedStampId, setSelectedStampId] = useState("default-approuve");
  const [selectedStampImageData, setSelectedStampImageData] = useState(null);
  const [selectedStampText, setSelectedStampText] = useState("APPROUVÉ");
  const [selectedStampColor, setSelectedStampColor] = useState(
    STAMP_DEFAULT_COLORS.approuve
  );
  const [stampKey, setStampKey] = useState("approuve");
  const [versionPreview, setVersionPreview] = useState(null);

  const activeFile = fullPage ? fichier : importedFile;
  const isBatchMode = Boolean(batchItems?.length);
  const pendingBatchCount = isBatchMode
    ? batchItems.filter((item) => item.status !== "submitted").length
    : 0;
  const isCurrentBatchItemSubmitted =
    isBatchMode && batchItems[batchActiveIndex]?.status === "submitted";

  const selectedTypeLibelle = useMemo(() => {
    const found = typeDocuments.find((t) => String(t.id) === String(selectedTypeId));
    return found?.libelle || found?.nom || "";
  }, [typeDocuments, selectedTypeId]);

  useEffect(() => {
    setLeftSidebarTab(isBatchMode ? "documents" : "pages");
  }, [isBatchMode]);

  const effectiveChamps = useMemo(
    () => mergeChampsWithZoneOverrides(champs, zoneOverrides),
    [champs, zoneOverrides]
  );

  const hasConfigurableZones = useMemo(
    () => effectiveChamps.some(champHasCaptureZone),
    [effectiveChamps]
  );

  const zoneCountByPage = useMemo(
    () => countZonesByPage(effectiveChamps),
    [effectiveChamps]
  );

  const zoneChamps = useMemo(
    () => effectiveChamps.filter(champHasCaptureZone),
    [effectiveChamps]
  );

  const navigateToChampPage = useCallback((champ) => {
    if (!champ) return;
    setActiveChampId(champ.id);
    const pageIdx = champ.capture_page ?? 0;
    setFocusPageIndex(pageIdx);
    setCurrentPage(pageIdx + 1);
  }, []);

  const handleSelectZoneChamp = useCallback(
    (champId) => {
      const champ = effectiveChamps.find((c) => c.id === champId);
      navigateToChampPage(champ);
    },
    [effectiveChamps, navigateToChampPage]
  );

  const handleNextZoneChamp = useCallback(() => {
    if (!zoneChamps.length) return;
    const currentIdx = zoneChamps.findIndex((c) => c.id === activeChampId);
    const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % zoneChamps.length;
    navigateToChampPage(zoneChamps[nextIdx]);
  }, [zoneChamps, activeChampId, navigateToChampPage]);

  const resetForNextDocument = useCallback(
    async (typeId) => {
      setFichier(null);
      setImportedFile(null);
      setFileModified(false);
      setCurrentPage(1);
      setPageCount(1);
      setZoneOverrides({});
      setShowZonesMode(false);
      setActiveChampId(null);
      setFocusPageIndex(null);
      setFilledChampIds([]);
      setOcrFilledCount(0);
      setOcrProgress(0);
      setFieldErrors({});
      setFilePreviewKey((k) => k + 1);
      setPendingPdfFile(null);
      setPendingPdfQueue([]);
      importHintKeyRef.current = null;
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      if (typeId) {
        setSelectedTypeId(String(typeId));
        await loadChamps(typeId);
      }
    },
    []
  );

  const navigateToPageIndex = useCallback((pageIndex0) => {
    setFocusPageIndex(pageIndex0);
    setCurrentPage(pageIndex0 + 1);
  }, []);

  const handlePreviewPageChange = useCallback((pageNum) => {
    setCurrentPage(pageNum);
    setFocusPageIndex(pageNum - 1);
  }, []);

  const loadTypes = useCallback(async () => {
    try {
      setLoadingTypes(true);
      const data = await getTypeDocuments();
      setTypeDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      onNotify?.(err.message || "Erreur chargement types", "error");
    } finally {
      setLoadingTypes(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    const el = formPanelRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      setFormPanelWidth(width);
    });
    observer.observe(el);
    setFormPanelWidth(el.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [fullPage, selectedTypeId]);

  const loadChamps = async (typeId, seedValues = null) => {
    if (!typeId) {
      setChamps([]);
      setFieldValues({});
      return;
    }
    try {
      setLoadingChamps(true);
      const data = await getChampsDocuments(typeId);
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.ordre - b.ordre) : [];
      setChamps(sorted);
      const initial = {};
      sorted.forEach((c) => {
        const fromDoc = seedValues?.find((v) => v.champ_id === c.id);
        let valeur = fromDoc?.valeur ?? "";
        if (c.type_champ === "datetime") {
          valeur = normalizeDatetimeLocalValue(valeur);
        }
        initial[c.id] = valeur;
      });
      setFieldValues(initial);
      setFieldErrors({});
      if (isEditMode && initialEditSnapshotRef.current) {
        initialEditSnapshotRef.current = {
          ...initialEditSnapshotRef.current,
          fieldValues: { ...initial },
        };
      }
    } catch (err) {
      onNotify?.(err.message || "Erreur chargement champs", "error");
    } finally {
      setLoadingChamps(false);
    }
  };

  useEffect(() => {
    if (documentToEdit) {
      setSelectedTypeId(String(documentToEdit.type_document));
      setVersionCourante(documentToEdit.version_courante || 1);
      loadChamps(documentToEdit.type_document, documentToEdit.valeurs);
      setImportedFile(null);
      setFichier(null);
      setFileModified(false);
      setCurrentPage(1);
      setPageCount(1);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (initialDraftId) return;
    setSelectedTypeId("");
    setChamps([]);
    setImportedFile(null);
    setFichier(null);
    setFileModified(false);
    setCurrentPage(1);
    setPageCount(1);
    setFieldValues({});
    setFieldErrors({});
    setFilledChampIds([]);
    setActiveChampId(null);
    setFocusPageIndex(null);
    setZoneAdjustMode(false);
    setShowZonesMode(false);
    setZoneOverrides({});
    setZonesDirty(false);
    setOcrProgress(0);
    setBatchItems(null);
    setBatchActiveIndex(0);
    setBatchSubmitProgress(null);
    importHintKeyRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [localite?.id, documentToEdit?.id, initialDraftId]);

  useEffect(() => {
    if (!fullPage || !isEditMode || !documentToEdit?.fichier_url) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingFile(true);
        const fileData = await fetchDocumentFileBlob(documentToEdit.fichier_url);
        if (cancelled) return;

        const rawFile = new File(
          [fileData.blob],
          documentToEdit.fichier_url?.split("/").pop() || "document.pdf",
          { type: fileData.blob.type || "application/pdf" }
        );
        const pdfFile = await normalizeToPdfFile(rawFile);
        if (cancelled) return;

        setFichier(pdfFile);
        const count = await getPdfPageCount(pdfFile);
        setPageCount(count);
        setFileModified(false);
        const loadedAnnotations = normalizeAnnotations(documentToEdit.annotations);
        setAnnotations(loadedAnnotations);
        setFilePreviewKey((k) => k + 1);
        initialEditSnapshotRef.current = {
          typeId: String(documentToEdit.type_document),
          annotations: loadedAnnotations,
          fieldValues: null,
        };
        await resetHistory(
          await createSnapshot({
            fichier: pdfFile,
            zoneOverrides: {},
            currentPage: 1,
            annotations: loadedAnnotations,
          })
        );
      } catch (err) {
        onNotify?.(err.message || "Impossible de charger le fichier", "error");
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullPage, isEditMode, documentToEdit?.id, documentToEdit?.fichier_url, onNotify, resetHistory, createSnapshot]);

  const refreshPageCount = useCallback(async (file) => {
    const count = await getPdfPageCount(file);
    let nextPage = 1;
    setPageCount(count);
    setCurrentPage((p) => {
      nextPage = Math.min(Math.max(1, p), count || 1);
      return nextPage;
    });
    setFocusPageIndex((idx) => {
      if (idx == null) return idx;
      return Math.min(Math.max(0, idx), Math.max(0, count - 1));
    });
    return nextPage;
  }, []);

  useEffect(() => {
    if (!fichier || pageCount < 1) return;
    setCurrentPage((p) => Math.min(Math.max(1, p), pageCount));
    setFocusPageIndex((idx) => {
      if (idx == null) return idx;
      return Math.min(Math.max(0, idx), pageCount - 1);
    });
  }, [pageCount, fichier, filePreviewKey]);

  const loadPdfDocument = useCallback(
    async (
      pdfFile,
      { notify = true, resetFields = true, initialFieldValues, initialZoneOverrides } = {}
    ) => {
      if (!notify) {
        importHintKeyRef.current = "restored-silent";
      }
      const nextZoneOverrides = initialZoneOverrides ?? (resetFields ? {} : undefined);
      setFichier(pdfFile);
      setFileModified(true);
      setFilePreviewKey((k) => k + 1);
      setCurrentPage(1);
      setFocusPageIndex(0);
      if (nextZoneOverrides !== undefined) {
        setZoneOverrides(nextZoneOverrides);
      } else {
        setZoneOverrides({});
      }
      setShowZonesMode(false);
      setActiveChampId(null);
      setFilledChampIds([]);
      setOcrFilledCount(0);
      if (initialFieldValues !== undefined) {
        setFieldValues(initialFieldValues);
      } else if (resetFields) {
        setFieldValues(buildEmptyFieldValues(champs));
      }
      if (notify) {
        importHintKeyRef.current = null;
      }
      if (resetFields) {
        markActiveItemForUploadRef.current();
      }
      await refreshPageCount(pdfFile);
      if (fullPage) {
        await resetHistory(
          await createSnapshot({
            fichier: pdfFile,
            zoneOverrides: nextZoneOverrides ?? {},
            currentPage: 1,
            annotations: [],
          })
        );
      }
      if (notify) {
        onNotify?.("Document chargé — vérifiez l'aperçu et les index.", "success");
      }
    },
    [champs, fullPage, refreshPageCount, resetHistory, createSnapshot, onNotify]
  );

  const getPersistedBatchItems = useCallback(() => {
    if (!batchItems?.length) return batchItems;
    return batchItems.map((item, index) =>
      index === batchActiveIndex
        ? {
            ...item,
            file: fichier || item.file,
            name: fichier?.name || item.name,
            fieldValues: { ...fieldValues },
            zoneOverrides: { ...zoneOverrides },
          }
        : item
    );
  }, [batchItems, batchActiveIndex, fichier, fieldValues, zoneOverrides]);

  const loadBatchItemIntoWorkbench = useCallback(
    async (item) => {
      setFieldErrors({});
      setFilledChampIds([]);
      setOcrFilledCount(0);
      let file = item.file;
      if (!file && item.fichierUrl) {
        file = await downloadDraftItemFile(item);
      }
      if (!file) {
        onNotify?.("Impossible de charger ce document du lot.", "error");
        return;
      }
      await loadPdfDocument(file, {
        notify: false,
        resetFields: false,
        initialFieldValues: item.fieldValues || buildEmptyFieldValues(champs),
        initialZoneOverrides: item.zoneOverrides || {},
      });
    },
    [champs, loadPdfDocument, onNotify]
  );

  const { clearDraft, persistNow, invalidateUploadedFiles } = useRattachementDraftPersistence({
    enabled: fullPage && !isEditMode,
    localite,
    initialDraftId,
    selectedTypeId,
    typeLibelle: selectedTypeLibelle,
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
  });

  const leaveGuard = useRattachementLeaveGuardOptional();
  const persistNowRef = useRef(persistNow);
  const clearDraftRef = useRef(clearDraft);
  persistNowRef.current = persistNow;
  clearDraftRef.current = clearDraft;

  const hasWorkInProgress = useMemo(() => {
    if (!fullPage || isEditMode || !localite) return false;
    return Boolean(
      buildRattachementDraftSnapshot({
        localite,
        selectedTypeId,
        typeLibelle: selectedTypeLibelle,
        batchActiveIndex,
        batchItems,
        fichier,
        fieldValues,
        zoneOverrides,
        getPersistedBatchItems,
      })
    );
  }, [
    fullPage,
    isEditMode,
    localite,
    selectedTypeId,
    selectedTypeLibelle,
    batchActiveIndex,
    batchItems,
    fichier,
    fieldValues,
    zoneOverrides,
    getPersistedBatchItems,
  ]);

  useEffect(() => {
    if (!leaveGuard || !fullPage || isEditMode) {
      leaveGuard?.registerGuard(null);
      return undefined;
    }
    leaveGuard.registerGuard({
      hasWorkInProgress,
      persistNow: () => persistNowRef.current(),
      clearDraft: () => clearDraftRef.current(),
    });
    return () => leaveGuard.registerGuard(null);
  }, [leaveGuard?.registerGuard, fullPage, isEditMode, hasWorkInProgress]);

  const markActiveItemForUpload = useCallback(() => {
    if (!fullPage || isEditMode) return;
    if (isBatchMode && batchItems?.[batchActiveIndex]?.id) {
      invalidateUploadedFiles(batchItems[batchActiveIndex].id);
      return;
    }
    if (localite?.id) {
      invalidateUploadedFiles(`single-${localite.id}`);
    }
  }, [
    fullPage,
    isEditMode,
    isBatchMode,
    batchItems,
    batchActiveIndex,
    localite?.id,
    invalidateUploadedFiles,
  ]);

  markActiveItemForUploadRef.current = markActiveItemForUpload;

  const handleAbandon = useCallback(async () => {
    if (fullPage && !isEditMode) {
      await clearDraft();
    }
    onClose?.();
  }, [fullPage, isEditMode, clearDraft, onClose]);

  const handleRetour = useCallback(() => {
    if (isEditMode) {
      onClose?.();
      return;
    }
    if (fullPage && hasWorkInProgress && leaveGuard) {
      leaveGuard.requestNavigation(() => onClose?.());
      return;
    }
    onClose?.();
  }, [isEditMode, fullPage, hasWorkInProgress, leaveGuard, onClose]);

  const handleSelectBatchDocument = useCallback(
    async (index) => {
      if (!batchItems?.length || index === batchActiveIndex || processing || submitting) return;
      setProcessing(true);
      try {
        const updated = getPersistedBatchItems();
        setBatchItems(updated);
        setBatchActiveIndex(index);
        await loadBatchItemIntoWorkbench(updated[index]);
        if (updated[index].status === "submitted") {
          onNotify?.("Document déjà soumis — consultation seule.", "info");
        }
      } catch (err) {
        onNotify?.(err.message || "Impossible de charger le document", "error");
      } finally {
        setProcessing(false);
      }
    },
    [
      batchItems,
      batchActiveIndex,
      processing,
      submitting,
      getPersistedBatchItems,
      loadBatchItemIntoWorkbench,
      onNotify,
    ]
  );

  const handleNextBatchDocument = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!batchItems?.length) return;
      const updated = getPersistedBatchItems();
      setBatchItems(updated);
      const nextIndex = batchActiveIndex + 1;
      if (nextIndex >= updated.length) {
        onNotify?.("Dernier document du lot atteint.", "info");
        return;
      }
      setBatchActiveIndex(nextIndex);
      await loadBatchItemIntoWorkbench(updated[nextIndex]);
    },
    [batchItems, batchActiveIndex, getPersistedBatchItems, loadBatchItemIntoWorkbench, onNotify]
  );

  const handleRemoveFromBatch = useCallback(
    async (indexToRemove = batchActiveIndex) => {
      if (!batchItems?.length || processing || submitting) return;

      const updated = getPersistedBatchItems();
      const item = updated[indexToRemove];
      if (!item) return;

      if (item.status === "submitted") {
        onNotify?.("Impossible de retirer un document déjà soumis.", "warning");
        return;
      }

      const removedName = item.name;
      const nextItems = updated.filter((_, index) => index !== indexToRemove);

      if (!nextItems.length) {
        setBatchItems(null);
        setBatchActiveIndex(0);
        await resetForNextDocument(selectedTypeId || undefined);
        onNotify?.(`« ${removedName} » retiré — le lot est vide.`, "success");
        return;
      }

      const removingActive = indexToRemove === batchActiveIndex;
      let newIndex = batchActiveIndex;
      if (indexToRemove < batchActiveIndex) {
        newIndex = batchActiveIndex - 1;
      } else if (removingActive) {
        newIndex = Math.min(batchActiveIndex, nextItems.length - 1);
      }

      setBatchItems(nextItems);
      setBatchActiveIndex(newIndex);

      if (removingActive) {
        await loadBatchItemIntoWorkbench(nextItems[newIndex]);
      }

      onNotify?.(`« ${removedName} » retiré du lot.`, "success");
    },
    [
      batchItems,
      batchActiveIndex,
      processing,
      submitting,
      getPersistedBatchItems,
      resetForNextDocument,
      selectedTypeId,
      loadBatchItemIntoWorkbench,
      onNotify,
    ]
  );

  const applyWorkbenchSnapshot = useCallback(
    async (snapshot) => {
      if (!snapshot) return;
      const nextAnnotations = Array.isArray(snapshot.annotations) ? snapshot.annotations : [];
      annotationsRef.current = nextAnnotations;
      setAnnotations(nextAnnotations);
      setSelectedAnnotationId(null);

      const nextOverrides = snapshot.zoneOverrides || {};
      setZoneOverrides(nextOverrides);

      if (snapshot.fichier && snapshot.fichier !== fichierRef.current) {
        setFichier(snapshot.fichier);
        setFileModified(true);
        setFilePreviewKey((k) => k + 1);
        const nextPage = await refreshPageCount(snapshot.fichier);
        const requestedPage = snapshot.currentPage ?? nextPage;
        const safePage = Math.min(Math.max(1, requestedPage), nextPage);
        setCurrentPage(safePage);
        setFocusPageIndex(safePage - 1);
        return;
      }

      if (snapshot.currentPage != null) {
        const safePage = Math.max(1, snapshot.currentPage);
        setCurrentPage(safePage);
        setFocusPageIndex(safePage - 1);
      }
    },
    [refreshPageCount]
  );

  const commitWorkbenchState = useCallback(
    async ({ fichier: file, zoneOverrides: overrides, currentPage: page, annotations: anns }) => {
      if (!fullPage || !file) return;
      await workbenchHistory.commitSnapshot(
        await createSnapshot({
          fichier: file,
          zoneOverrides: overrides ?? {},
          currentPage: page ?? 1,
          annotations: anns ?? annotationsRef.current,
        })
      );
    },
    [fullPage, workbenchHistory, createSnapshot]
  );

  const commitAnnotationSnapshot = useCallback(
    async (nextAnnotations) => {
      if (!fullPage || !fichierRef.current) return;
      await workbenchHistory.commitSnapshot({
        fichier: fichierRef.current,
        zoneOverrides,
        currentPage,
        annotations: nextAnnotations ?? annotationsRef.current,
      });
    },
    [fullPage, workbenchHistory, zoneOverrides, currentPage]
  );

  const handleWorkbenchUndo = useCallback(async () => {
    const snapshot = workbenchHistory.undo();
    if (snapshot) await applyWorkbenchSnapshot(snapshot);
  }, [workbenchHistory, applyWorkbenchSnapshot]);

  const handleWorkbenchRedo = useCallback(async () => {
    const snapshot = workbenchHistory.redo();
    if (snapshot) await applyWorkbenchSnapshot(snapshot);
  }, [workbenchHistory, applyWorkbenchSnapshot]);

  useEffect(() => {
    if (!fullPage) return undefined;
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleWorkbenchUndo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleWorkbenchRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullPage, handleWorkbenchUndo, handleWorkbenchRedo]);

  const applyFileUpdate = useCallback(
    async (newFile, successMessage, historyState = null) => {
      setProcessing(true);
      try {
        setFichier(newFile);
        setFileModified(true);
        markActiveItemForUploadRef.current();
        setFilePreviewKey((k) => k + 1);
        const nextPage = await refreshPageCount(newFile);
        onNotify?.(successMessage, "success");
        if (fullPage) {
          await commitWorkbenchState(
            historyState ?? {
              fichier: newFile,
              zoneOverrides,
              currentPage: nextPage,
            }
          );
        }
      } catch (err) {
        onNotify?.(err.message || "Erreur lors de la manipulation du document", "error");
      } finally {
        setProcessing(false);
      }
    },
    [onNotify, refreshPageCount, fullPage, commitWorkbenchState, zoneOverrides]
  );

  const handleCancelOcr = useCallback(() => {
    ocrAbortRef.current?.();
    ocrRequestIdRef.current += 1;
    setOcrLoading(false);
    setOcrProgress(0);
    onNotify?.("Extraction annulée.", "info");
  }, [onNotify]);

  const runOcrExtraction = useCallback(
    async (file, typeId, currentChamps, overrides = {}, { partial = false } = {}) => {
      if (!file || !typeId || !currentChamps?.length || isEditMode) {
        setOcrFilledCount(0);
        setOcrLoading(false);
        setOcrProgress(0);
        return;
      }

      const requestId = ++ocrRequestIdRef.current;
      const overridePayload = zoneOverridesToPayload(overrides);
      const ocrPages =
        partial && overridePayload.length
          ? [...new Set(overridePayload.map((zone) => zone.capture_page))]
          : undefined;

      try {
        setOcrLoading(true);
        setOcrProgress(0);
        if (!partial) {
          setFilledChampIds([]);
          setFieldValues(buildEmptyFieldValues(currentChamps));
        }
        const result = await extractDocumentFields({
          fichier: file,
          typeDocumentId: Number(typeId),
          zoneOverrides: overridePayload.length ? overridePayload : undefined,
          ocrPages,
          abortRef: ocrAbortRef,
          onProgress: (percent) => {
            if (requestId === ocrRequestIdRef.current) {
              setOcrProgress(percent);
            }
          },
        });

        if (requestId !== ocrRequestIdRef.current) return;

        const extracted = Array.isArray(result?.champs) ? result.champs : [];

        if (!extracted.length) {
          if (!partial) {
            setFilledChampIds([]);
            setOcrFilledCount(0);
            setFieldValues(buildEmptyFieldValues(currentChamps));
          }
          if (result?.compatibilite?.message) {
            onNotify?.(result.compatibilite.message, "warning");
          } else {
            onNotify?.("Document analysé — aucun champ n'a pu être détecté automatiquement.", "info");
          }
          return;
        }

        const nextValues = partial
          ? { ...fieldValues }
          : buildEmptyFieldValues(currentChamps);
        const actuallyFilledIds = [];
        extracted.forEach(({ champ_id, valeur }) => {
          if (valeur == null || String(valeur).trim() === "") {
            return;
          }
          const champ = currentChamps.find((c) => c.id === champ_id);
          const normalized =
            champ?.type_champ === "datetime"
              ? normalizeDatetimeLocalValue(valeur)
              : String(valeur);
          if (String(normalized).trim() === "") {
            return;
          }
          nextValues[champ_id] = normalized;
          actuallyFilledIds.push(champ_id);
        });
        setFieldValues(nextValues);

        const mergedFilledIds = partial
          ? [...new Set([...filledChampIds, ...actuallyFilledIds])]
          : actuallyFilledIds;
        setFilledChampIds(mergedFilledIds);
        setOcrFilledCount(mergedFilledIds.length);
        setZonesDirty(false);

        if (!actuallyFilledIds.length) {
          onNotify?.("Document analysé — aucune valeur n'a pu être extraite des zones.", "info");
          return;
        }
        const methode = result?.methode || "";
        const methodeLabel =
          methode === "qr"
            ? "code QR"
            : methode === "code_barre"
              ? "code barre"
              : methode === "zones+alignement" || methode === "zones+alignement+qr" || methode === "zones+alignement+code_barre"
                ? "zones + alignement"
                : methode === "zones" || methode === "zones+qr" || methode === "zones+code_barre"
                  ? "zones de capture"
                  : methode === "zones+libelle" || methode === "zones+libelle+qr" || methode === "zones+libelle+code_barre"
                    ? "zones + libellés"
                    : methode === "pdf_native" || methode === "pdf_native_zone" || methode.startsWith("pdf_native")
                      ? "extraction PDF"
                      : methode.includes("qr") || methode.includes("code_barre")
                        ? "OCR + décodage"
                        : "OCR";
        const warnMsg =
          result?.compatibilite?.message && !(partial && actuallyFilledIds.length > 0)
            ? result.compatibilite.message
            : null;
        onNotify?.(
          warnMsg
            ? `${warnMsg} (${actuallyFilledIds.length} champ${actuallyFilledIds.length > 1 ? "s" : ""} détecté${actuallyFilledIds.length > 1 ? "s" : ""} — vérifiez chaque valeur.)`
            : `${actuallyFilledIds.length} champ${actuallyFilledIds.length > 1 ? "s" : ""} pré-rempli${actuallyFilledIds.length > 1 ? "s" : ""} (${methodeLabel}). Vérifiez les valeurs.`,
          warnMsg ? "warning" : "success"
        );
      } catch (err) {
        if (requestId !== ocrRequestIdRef.current) return;
        if (err.cancelled) return;
        setOcrFilledCount(0);
        if (!err.ocrUnavailable) {
          onNotify?.(err.message || "Erreur lors de l'extraction OCR", "error");
        } else {
          onNotify?.("OCR indisponible sur le serveur — saisissez les champs manuellement.", "info");
        }
      } finally {
        if (requestId === ocrRequestIdRef.current) {
          setOcrLoading(false);
          setOcrProgress(0);
        }
      }
    },
    [isEditMode, onNotify, fieldValues, filledChampIds]
  );

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedTypeId(typeId);
    setOcrFilledCount(0);
    setFilledChampIds([]);
    importHintKeyRef.current = null;
    loadChamps(
      typeId,
      isEditMode && String(typeId) === String(documentToEdit?.type_document)
        ? documentToEdit.valeurs
        : null
    );
  };

  const canRunExtraction =
    !isEditMode && Boolean(activeFile) && Boolean(selectedTypeId) && champs.length > 0 && !ocrLoading;

  const handleRunExtraction = () => {
    if (!canRunExtraction) return;
    // Ré-extraction partielle seulement si des champs sont déjà remplis (ajustement de zones).
    const partial = zonesDirty && filledChampIds.length > 0;
    runOcrExtraction(activeFile, selectedTypeId, champs, zoneOverrides, { partial });
  };

  useEffect(() => {
    if (isEditMode || !activeFile || !selectedTypeId || loadingChamps || !champs.length) {
      return;
    }
    const hintKey = `${activeFile.name}-${activeFile.size}-${activeFile.lastModified}-${selectedTypeId}`;
    if (importHintKeyRef.current === hintKey) {
      return;
    }
    if (importHintKeyRef.current === "restored-silent") {
      importHintKeyRef.current = hintKey;
      if (hasConfigurableZones && fullPage) {
        setShowZonesMode(true);
      }
      return;
    }
    importHintKeyRef.current = hintKey;

    if (hasConfigurableZones) {
      if (fullPage) {
        setShowZonesMode(true);
      } else {
        setZoneAdjustMode(true);
      }
      const first = champs.find(champHasCaptureZone);
      if (first) {
        if (fullPage) {
          navigateToChampPage(first);
        } else {
          setActiveChampId(first.id);
          setFocusPageIndex(first.capture_page ?? 0);
        }
      }
      onNotify?.(
        "Document importé — vérifiez les zones sur l'aperçu, ajustez-les si besoin, puis cliquez sur « Extraire ».",
        "info"
      );
    } else {
      onNotify?.(
        "Document importé — saisissez les champs manuellement ou cliquez sur « Extraire ».",
        "info"
      );
    }
  }, [
    activeFile,
    selectedTypeId,
    champs,
    loadingChamps,
    isEditMode,
    hasConfigurableZones,
    fullPage,
    onNotify,
    navigateToChampPage,
  ]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok =
      file.type.startsWith("image/") ||
      file.type === "application/pdf" ||
      /\.(pdf|jpe?g|png|webp|gif)$/.test(name);
    if (!ok) {
      onNotify?.("Format non supporté. Utilisez PDF ou image.", "error");
      e.target.value = "";
      return;
    }
    setImportedFile(file);
    setOcrFilledCount(0);
    setFilledChampIds([]);
    setFieldValues(buildEmptyFieldValues(champs));
    setZoneOverrides({});
    setZonesDirty(false);
    setZoneAdjustMode(false);
    importHintKeyRef.current = null;
  };

  const handleReplaceDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setProcessing(true);
    try {
      const pdfFile = await normalizeToPdfFile(file);
      setBatchItems(null);
      setBatchActiveIndex(0);
      setBatchSubmitProgress(null);
      await loadPdfDocument(pdfFile, { resetFields: !isEditMode });
    } catch (err) {
      onNotify?.(err.message || "Impossible de charger le fichier", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchImport = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (!rawFiles.length) return;
    if (!selectedTypeId) {
      onNotify?.("Sélectionnez d'abord un type de document.", "error");
      return;
    }

    setProcessing(true);
    try {
      const pdfs = [];
      for (const file of rawFiles) {
        if (!isAcceptedImportFile(file)) continue;
        pdfs.push(await normalizeToPdfFile(file));
      }
      if (!pdfs.length) {
        onNotify?.("Aucun fichier valide dans le lot (PDF ou image).", "error");
        return;
      }

      const newItems = pdfs.map((file) => createBatchItem(file, champs));

      if (!fichier && !batchItems?.length) {
        setBatchItems(newItems);
        setBatchActiveIndex(0);
        await loadBatchItemIntoWorkbench(newItems[0]);
        onNotify?.(
          `${newItems.length} document${newItems.length > 1 ? "s" : ""} importé${newItems.length > 1 ? "s" : ""} — renseignez chaque document puis soumettez le lot.`,
          "info"
        );
        return;
      }

      let merged = batchItems ? getPersistedBatchItems() : [];
      if (!batchItems && fichier) {
        merged = [
          createBatchItem(fichier, champs, {
            fieldValues,
            zoneOverrides,
          }),
        ];
      }
      merged = [...merged, ...newItems];
      const stayIndex = batchItems ? batchActiveIndex : 0;
      setBatchItems(merged);
      setBatchActiveIndex(stayIndex);
      onNotify?.(
        `${pdfs.length} document${pdfs.length > 1 ? "s" : ""} ajouté${pdfs.length > 1 ? "s" : ""} — lot de ${merged.length} documents.`,
        "success"
      );
    } catch (err) {
      onNotify?.(err.message || "Impossible d'importer le lot", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !fichier) return;

    const images = files.filter((f) => !isPdfFile(f));
    const pdfs = files.filter((f) => isPdfFile(f));

    setProcessing(true);
    try {
      let updated = fichier;
      for (const img of images) {
        updated = await appendSelectedPagesToPdf(updated, img, null);
      }
      if (images.length) {
        setFichier(updated);
        setFileModified(true);
        setFilePreviewKey((k) => k + 1);
        const nextPage = await refreshPageCount(updated);
        if (fullPage) {
          await commitWorkbenchState({
            fichier: updated,
            zoneOverrides,
            currentPage: nextPage,
          });
        }
        onNotify?.(
          `${images.length} image${images.length > 1 ? "s" : ""} ajoutée${images.length > 1 ? "s" : ""}`,
          "success"
        );
      }

      if (pdfs.length) {
        setPendingPdfQueue(pdfs.slice(1));
        setPendingPdfFile(pdfs[0]);
      } else {
        setProcessing(false);
      }
    } catch (err) {
      onNotify?.(err.message || "Impossible d'ajouter les pages", "error");
      setProcessing(false);
    }
  };

  const handlePdfPagesConfirm = async (pageIndices) => {
    if (!pendingPdfFile || !fichier) return;
    setProcessing(true);
    try {
      const updated = await appendSelectedPagesToPdf(fichier, pendingPdfFile, pageIndices);
      setFichier(updated);
      setFileModified(true);
      setFilePreviewKey((k) => k + 1);
      const nextPage = await refreshPageCount(updated);
      if (fullPage) {
        await commitWorkbenchState({
          fichier: updated,
          zoneOverrides,
          currentPage: nextPage,
        });
      }
      onNotify?.(
        `${pageIndices.length} page${pageIndices.length > 1 ? "s" : ""} ajoutée${pageIndices.length > 1 ? "s" : ""} depuis ${pendingPdfFile.name}`,
        "success"
      );

      const [next, ...rest] = pendingPdfQueue;
      setPendingPdfFile(next || null);
      setPendingPdfQueue(rest);
      if (!next) setProcessing(false);
    } catch (err) {
      onNotify?.(err.message || "Impossible d'ajouter les pages", "error");
      setPendingPdfFile(null);
      setPendingPdfQueue([]);
      setProcessing(false);
    }
  };

  const handlePdfPagesCancel = () => {
    setPendingPdfFile(null);
    setPendingPdfQueue([]);
    setProcessing(false);
  };

  const handleRemovePage = async () => {
    if (pageCount <= 1) {
      onNotify?.("Le document doit contenir au moins une page", "warning");
      return;
    }
    setProcessing(true);
    try {
      const updated = await removePageFromPdf(fichier, currentPage - 1);
      await applyFileUpdate(updated, `Page ${currentPage} supprimée`);
    } catch (err) {
      onNotify?.(err.message || "Impossible de supprimer la page", "error");
      setProcessing(false);
    }
  };

  const handleCropConfirm = async ({ cropRect, rotationDegrees = 0 }) => {
    setShowCropModal(false);
    setProcessing(true);
    try {
      let updated = fichier;
      if (rotationDegrees) {
        const steps = Math.round(rotationDegrees / 90);
        for (let i = 0; i < steps; i++) {
          updated = await rotatePdfPage(updated, currentPage - 1, "right");
        }
      }
      updated = await cropPdfPage(updated, currentPage - 1, cropRect);
      const parts = [`Page ${currentPage} rognée`];
      if (rotationDegrees) parts.push("et pivotée");
      await applyFileUpdate(updated, parts.join(" "));
    } catch (err) {
      onNotify?.(err.message || "Impossible de rogner la page", "error");
      setProcessing(false);
    }
  };

  const handleFieldChange = (champId, valeur) => {
    setFieldValues((prev) => ({ ...prev, [champId]: valeur }));
    if (fieldErrors[champId]) {
      setFieldErrors((prev) => ({ ...prev, [champId]: null }));
    }
  };

  const handleChampFocus = (champId) => {
    const champ = effectiveChamps.find((c) => c.id === champId);
    if (champ) {
      navigateToChampPage(champ);
    } else {
      setActiveChampId(champId);
    }
  };

  const handleZoneChange = useCallback(
    async (champId, patch) => {
      const nextOverrides = {
        ...zoneOverrides,
        [champId]: {
          ...(zoneOverrides[champId] || {}),
          ...patch,
        },
      };
      setZoneOverrides(nextOverrides);
      setZonesDirty(true);
      if (fullPage && fichier) {
        await commitWorkbenchState({
          fichier,
          zoneOverrides: nextOverrides,
          currentPage,
        });
      }
    },
    [zoneOverrides, fullPage, fichier, currentPage, commitWorkbenchState]
  );

  const activeZoneChamp = useMemo(() => {
    if (!activeChampId) return null;
    const champ = effectiveChamps.find((c) => c.id === activeChampId);
    return champ && champHasCaptureZone(champ) ? champ : null;
  }, [activeChampId, effectiveChamps]);

  const handleActiveZonePageSelect = (pageIndex0) => {
    if (!activeChampId) return;
    handleZoneChange(activeChampId, { capture_page: pageIndex0 });
    navigateToPageIndex(pageIndex0);
  };

  const handleAssignZoneToCurrentPage = () => {
    if (!activeChampId) return;
    handleZoneChange(activeChampId, { capture_page: currentPage - 1 });
  };

  const handleToggleZoneAdjust = () => {
    setZoneAdjustMode((prev) => {
      const next = !prev;
      if (next && !activeChampId) {
        const first = effectiveChamps.find(champHasCaptureZone);
        if (first) {
          setActiveChampId(first.id);
          setFocusPageIndex(first.capture_page ?? 0);
        }
      }
      return next;
    });
  };

  const handleToggleZones = () => {
    if (!hasConfigurableZones) {
      onNotify?.("Aucune zone de capture configurée pour ce type de document.", "info");
      return;
    }
    setShowZonesMode((prev) => {
      const next = !prev;
      if (next) {
        const onPage = effectiveChamps.find(
          (c) => champHasCaptureZone(c) && (c.capture_page ?? 0) === currentPage - 1
        );
        const first = onPage || effectiveChamps.find(champHasCaptureZone);
        if (first) {
          navigateToChampPage(first);
        }
      } else {
        setActiveChampId(null);
      }
      return next;
    });
  };

  const validateFields = () => {
    const errors = {};
    champs.forEach((champ) => {
      if (champ.obligatoire && !String(fieldValues[champ.id] ?? "").trim()) {
        errors[champ.id] = "Ce champ est obligatoire";
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasEditChanges = useMemo(() => {
    if (!isEditMode) return false;
    const snap = initialEditSnapshotRef.current;
    if (fileModified) return true;
    if (snap?.typeId && String(selectedTypeId) !== String(snap.typeId)) return true;
    if (JSON.stringify(annotations) !== JSON.stringify(snap?.annotations || [])) return true;
    const snapFields = snap?.fieldValues || {};
    const keys = new Set([...Object.keys(fieldValues), ...Object.keys(snapFields)]);
    for (const key of keys) {
      if (String(fieldValues[key] ?? "") !== String(snapFields[key] ?? "")) return true;
    }
    return false;
  }, [isEditMode, fileModified, selectedTypeId, annotations, fieldValues]);

  const handleAnnotationsChange = useCallback(
    (next, options = {}) => {
      setAnnotations((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        annotationsRef.current = resolved;
        if (options.recordHistory !== false) {
          void commitAnnotationSnapshot(resolved);
        }
        return resolved;
      });
    },
    [commitAnnotationSnapshot]
  );

  const handleAnnotationHistoryCommit = useCallback(() => {
    void commitAnnotationSnapshot(annotationsRef.current);
  }, [commitAnnotationSnapshot]);

  const handleAnnotationColorChange = useCallback(
    (color) => {
      setAnnotationColor(color);
      if (!selectedAnnotationId) return;
      setAnnotations((prev) => {
        const next = prev.map((ann) =>
          ann.id === selectedAnnotationId ? { ...ann, color } : ann
        );
        annotationsRef.current = next;
        void commitAnnotationSnapshot(next);
        return next;
      });
    },
    [selectedAnnotationId, commitAnnotationSnapshot]
  );

  const handleAnnotationUndo = useCallback(() => {
    void handleWorkbenchUndo();
  }, [handleWorkbenchUndo]);

  const handleAnnotationRedo = useCallback(() => {
    void handleWorkbenchRedo();
  }, [handleWorkbenchRedo]);

  const handleAnnotationClearPage = useCallback(() => {
    setAnnotations((prev) => {
      const next = prev.filter((a) => (a.page ?? 0) !== currentPage - 1);
      annotationsRef.current = next;
      void commitAnnotationSnapshot(next);
      return next;
    });
    setSelectedAnnotationId(null);
  }, [currentPage, commitAnnotationSnapshot]);

  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations((prev) => {
      const next = prev.filter((a) => a.id !== selectedAnnotationId);
      annotationsRef.current = next;
      void commitAnnotationSnapshot(next);
      return next;
    });
    setSelectedAnnotationId(null);
  }, [selectedAnnotationId, commitAnnotationSnapshot]);

  const fetchImageAsDataUrl = useCallback(async (url) => {
    if (!url) return null;
    if (url.startsWith("data:")) return url;
    const headers = {};
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) headers.Authorization = `Token ${token}`;
    }
    try {
      const res = await apiFetch(url, { headers });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }, []);

  const refreshUserSignatures = useCallback(async () => {
    if (!isEditMode) return;
    try {
      const items = await listUserSignatures();
      setUserSignatures(items);
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        setSignatureUsername(storedUser.username || "");
      } catch {
        setSignatureUsername("");
      }

      setSelectedSignatureId((prevId) => {
        // Ne pas auto-activer une signature protégée (mot de passe requis au clic)
        const preferred =
          items.find((s) => s.id === prevId && !s.has_password) ||
          items.find((s) => s.is_default && !s.has_password) ||
          items.find((s) => !s.has_password) ||
          null;
        if (!preferred) {
          setSelectedSignatureDataUrl(null);
          return null;
        }
        fetchImageAsDataUrl(resolveMediaUrl(preferred.image_url)).then((dataUrl) => {
          setSelectedSignatureDataUrl(dataUrl);
        });
        return preferred.id;
      });
    } catch {
      setUserSignatures([]);
    }
  }, [isEditMode, fetchImageAsDataUrl]);

  const handleSelectSignature = useCallback(
    async (id, sig) => {
      setSelectedSignatureId(id);
      if (!sig?.image_url) {
        setSelectedSignatureDataUrl(null);
        return;
      }
      const dataUrl = await fetchImageAsDataUrl(resolveMediaUrl(sig.image_url));
      setSelectedSignatureDataUrl(dataUrl);
      setAnnotationTool(ANNOTATION_TOOLS.SIGNATURE);
    },
    [fetchImageAsDataUrl]
  );

  const handleSelectStamp = useCallback((id, stamp) => {
    setSelectedStampId(id);
    if (!stamp) {
      setSelectedStampImageData(null);
      setSelectedStampText(null);
      return;
    }
    if (stamp.kind === "custom") {
      setSelectedStampImageData(stamp.imageData || null);
      setSelectedStampText(stamp.text || stamp.label || "Tampon");
      setStampKey("custom");
    } else {
      setSelectedStampImageData(null);
      setSelectedStampText(stamp.text || stamp.label);
      setStampKey(stamp.key || "approuve");
      const defaultColor =
        stamp.color || STAMP_DEFAULT_COLORS[stamp.key] || STAMP_DEFAULT_COLORS.approuve;
      setSelectedStampColor(defaultColor);
    }
    setAnnotationTool(ANNOTATION_TOOLS.STAMP);
  }, []);

  const handleAnnotationToolChange = useCallback((toolId) => {
    if (toolId === ANNOTATION_TOOLS.HIGHLIGHT || toolId === ANNOTATION_TOOLS.RECT || toolId === ANNOTATION_TOOLS.TEXT || toolId === ANNOTATION_TOOLS.PEN) {
      if (!hasPermission(PERMISSIONS.ANNOTER_DOCUMENT)) return;
    }
    if (toolId === ANNOTATION_TOOLS.STAMP && !hasPermission(PERMISSIONS.TAMPONNER_DOCUMENT)) return;
    if (toolId === ANNOTATION_TOOLS.SIGNATURE && !hasPermission(PERMISSIONS.SIGNER_DOCUMENT)) return;
    setAnnotationTool(toolId);
  }, []);

  const loadDocumentVersions = useCallback(async () => {
    if (!documentToEdit?.id) return;
    setVersionsLoading(true);
    try {
      const data = await getDocumentVersions(documentToEdit.id);
      setDocumentVersions(data.results || []);
      if (data.version_courante != null) {
        setVersionCourante(data.version_courante);
      }
    } catch (err) {
      onNotify?.(err.message || "Impossible de charger les versions", "error");
    } finally {
      setVersionsLoading(false);
    }
  }, [documentToEdit?.id, onNotify]);

  useEffect(() => {
    if (isEditMode && fullPage) {
      refreshUserSignatures();
      loadDocumentVersions();
    }
  }, [isEditMode, fullPage, refreshUserSignatures, loadDocumentVersions]);

  const handleRightRailSelect = useCallback(
    (panelId) => {
      if (panelId === "annotations" && !hasPermission(PERMISSIONS.ANNOTER_DOCUMENT)) return;
      if (panelId === "stamps" && !hasPermission(PERMISSIONS.TAMPONNER_DOCUMENT)) return;
      if (panelId === "signatures" && !hasPermission(PERMISSIONS.SIGNER_DOCUMENT)) return;
      if (panelId === "notes" && !hasPermission(PERMISSIONS.COMMENTER_DOCUMENT)) return;
      setRightRailPanel(panelId);
      if (panelId === "versions") {
        loadDocumentVersions();
      }
      if (panelId === "stamps") {
        setAnnotationTool(ANNOTATION_TOOLS.STAMP);
      }
      if (panelId === "signatures") {
        setAnnotationTool(ANNOTATION_TOOLS.SIGNATURE);
      }
    },
    [loadDocumentVersions]
  );

  const performEditSave = useCallback(
    async (saveMode) => {
      const valeurs = buildValeursPayload(champs, fieldValues, { refreshRegistrationDate: true });
      const refreshedFieldValues = { ...fieldValues };
      champs.forEach((champ) => {
        const entry = valeurs.find((v) => v.champ_id === champ.id);
        if (entry) refreshedFieldValues[champ.id] = entry.valeur;
      });

      let fileToSend;
      if (fichier && fileModified) {
        // PDF sans gravure des annotations (elles restent en JSON) pour éviter la double superposition.
        fileToSend = fichier;
      }

      const result = await updateDocumentLocalite(documentToEdit.id, {
        typeDocumentId: Number(selectedTypeId),
        fichier: fileToSend,
        valeurs,
        annotations,
        saveMode,
      });

      if (result?.version_courante != null) {
        setVersionCourante(result.version_courante);
      }

      initialEditSnapshotRef.current = {
        typeId: String(selectedTypeId),
        fieldValues: { ...refreshedFieldValues },
        annotations: [...annotations],
      };
      setFieldValues(refreshedFieldValues);
      setFileModified(false);

      if (onSaved) {
        onSaved(result);
      } else {
        onNotify?.(
          saveMode === "new_version"
            ? `Nouvelle version (v${result?.version_courante ?? "?"}) enregistrée`
            : "Document modifié avec succès",
          "success"
        );
      }
      return result;
    },
    [
      annotations,
      champs,
      documentToEdit?.id,
      fieldValues,
      fileModified,
      fichier,
      onNotify,
      onSaved,
      selectedTypeId,
    ]
  );

  const handleSubmit = async (e, andNext = false) => {
    e?.preventDefault?.();
    if (isBatchMode) {
      await handleSubmitBatch(e);
      return;
    }
    if (!selectedTypeId) {
      onNotify?.("Sélectionnez un type de document", "error");
      return;
    }
    if (!isEditMode && !activeFile) {
      onNotify?.("Importez un document (PDF ou image)", "error");
      return;
    }
    if (isEditMode && !activeFile && !documentToEdit?.fichier_url) {
      onNotify?.("Aucun fichier disponible pour ce document", "error");
      return;
    }
    if (!validateFields()) return;

    if (isEditMode) {
      if (!hasEditChanges) {
        onNotify?.("Aucune modification à enregistrer.", "info");
        return;
      }
      setShowSaveModeModal(true);
      return;
    }

    const keepTypeId = selectedTypeId;

    try {
      setSubmitting(true);
      const valeurs = buildValeursPayload(champs, fieldValues, { refreshRegistrationDate: true });

      const filePayload = fullPage ? fichier : importedFile || undefined;

      const created = await createDocumentLocalite({
        localiteId: localite.id,
        typeDocumentId: Number(selectedTypeId),
        fichier: filePayload,
        valeurs,
      });
      const docId = created?.id;
      if (!docId) {
        throw new Error(
          "Document créé mais identifiant manquant — impossible de soumettre à validation."
        );
      }
      const result = await soumettreControleQualite(docId, { valeurs });

      if (andNext) {
        onNotify?.("Document soumis — rattachez le suivant (même type conservé).", "success");
        await clearDraft();
        await resetForNextDocument(keepTypeId);
        return;
      }

      await clearDraft();
      if (onSaved) {
        onSaved(result);
      } else {
        onNotify?.("Document soumis au contrôle qualité", "success");
      }
    } catch (err) {
      onNotify?.(err.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBatch = async (e) => {
    e?.preventDefault?.();
    if (!selectedTypeId || !batchItems?.length) return;

    const updated = getPersistedBatchItems();
    const toSubmit = updated.filter((item) => item.status !== "submitted");
    if (!toSubmit.length) {
      onNotify?.("Tous les documents du lot sont déjà soumis.", "info");
      await clearDraft();
      if (onSaved) onSaved(null);
      return;
    }

    let firstInvalidIndex = -1;
    let firstErrors = {};
    updated.forEach((item, index) => {
      if (item.status === "submitted") return;
      const errors = validateItemFieldValues(item, champs);
      if (Object.keys(errors).length && firstInvalidIndex < 0) {
        firstInvalidIndex = index;
        firstErrors = errors;
      }
    });

    if (firstInvalidIndex >= 0) {
      setBatchItems(updated);
      if (firstInvalidIndex !== batchActiveIndex) {
        setBatchActiveIndex(firstInvalidIndex);
        await loadBatchItemIntoWorkbench(updated[firstInvalidIndex]);
      }
      setFieldErrors(firstErrors);
      onNotify?.(
        `Document ${firstInvalidIndex + 1}/${updated.length} : champs obligatoires manquants.`,
        "error"
      );
      return;
    }

    setSubmitting(true);
    let lastResult = null;
    let successCount = 0;
    const finalItems = [...updated];

    try {
      for (let index = 0; index < finalItems.length; index += 1) {
        const item = finalItems[index];
        if (item.status === "submitted") continue;

        setBatchSubmitProgress({ current: successCount + 1, total: toSubmit.length });

        const valeurs = champs.map((champ) => ({
          champ_id: champ.id,
          valeur: String(item.fieldValues[champ.id] ?? ""),
        }));

        const created = await createDocumentLocalite({
          localiteId: localite.id,
          typeDocumentId: Number(selectedTypeId),
          fichier: item.file,
          valeurs,
        });
        const docId = created?.id;
        if (!docId) {
          throw new Error(`Document ${index + 1} : identifiant manquant après création.`);
        }
        lastResult = await soumettreControleQualite(docId, { valeurs });
        finalItems[index] = { ...item, status: "submitted" };
        successCount += 1;
      }

      setBatchItems(finalItems);
      onNotify?.(
        `Lot soumis — ${successCount} document${successCount > 1 ? "s" : ""} envoyé${successCount > 1 ? "s" : ""} au contrôle qualité.`,
        "success"
      );
      await clearDraft();
      if (onSaved) {
        onSaved(lastResult);
      }
    } catch (err) {
      setBatchItems(finalItems);
      await persistNow();
      onNotify?.(err.message || "Erreur lors de la soumission du lot", "error");
    } finally {
      setSubmitting(false);
      setBatchSubmitProgress(null);
    }
  };

  if (!localite) return null;

  const formColumnCount = formPanelWidth >= 680 ? 3 : formPanelWidth >= 420 ? 2 : 1;
  const showOcrLoading = ocrLoading && !isEditMode && Boolean(activeFile) && Boolean(selectedTypeId);
  const busy = processing || loadingFile || submitting || ocrLoading;
  const manipulationDisabled = busy || !selectedTypeId;
  const zonesOnCurrentPage = filterZonesForPage(effectiveChamps, currentPage - 1).length;
  const hasZonesOnOtherPages =
    fullPage &&
    showZonesMode &&
    hasConfigurableZones &&
    zonesOnCurrentPage === 0 &&
    Object.keys(zoneCountByPage).length > 0;

  const annotationPreviewProps = isEditMode
    ? {
        annotationMode: true,
        annotations,
        onAnnotationsChange: handleAnnotationsChange,
        annotationTool,
        onAnnotationToolChange: handleAnnotationToolChange,
        annotationColor,
        onAnnotationColorChange: handleAnnotationColorChange,
        stampKey,
        onStampKeyChange: setStampKey,
        stampImageData: selectedStampImageData,
        stampText: selectedStampText,
        stampColor: selectedStampColor,
        onRequestStamp: () => setRightRailPanel("stamps"),
        onAnnotationUndo: handleAnnotationUndo,
        onAnnotationRedo: handleAnnotationRedo,
        onAnnotationClearPage: handleAnnotationClearPage,
        onAnnotationDeleteSelected: handleDeleteSelectedAnnotation,
        canAnnotationUndo: workbenchHistory.canUndo,
        canAnnotationRedo: workbenchHistory.canRedo,
        canAnnotationDeleteSelected: Boolean(selectedAnnotationId),
        selectedAnnotationId,
        onSelectAnnotation: setSelectedAnnotationId,
        onAnnotationsHistoryCommit: handleAnnotationHistoryCommit,
        hideAnnotationToolbar: fullPage,
        signatureImageData: selectedSignatureDataUrl,
        onRequestSignature: () => setRightRailPanel("signatures"),
      }
    : {};

  const previewPane = (
    <div className="flex flex-col h-full min-h-0 bg-slate-100 overflow-hidden">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 pt-4 pb-2 shrink-0 flex flex-wrap items-center gap-2">
        <span>Aperçu — molette ou glisser (main) pour naviguer</span>
        {hasConfigurableZones && !isEditMode && importedFile && (
          <button
            type="button"
            onClick={handleToggleZoneAdjust}
            disabled={ocrLoading}
            className={`normal-case tracking-normal px-2 py-1 rounded text-[11px] font-medium border transition ${
              zoneAdjustMode
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {zoneAdjustMode ? "Zones : ajustement actif" : "Ajuster les zones"}
          </button>
        )}
      </p>
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
        <DocumentPreview
          file={importedFile}
          previewUrl={!importedFile && isEditMode ? documentToEdit?.fichier_url : undefined}
          large={fullPage}
          zoomable={fullPage}
          fileInputRef={fileInputRef}
          acceptFiles={ACCEPTED_FILES}
          importEnabled={Boolean(selectedTypeId)}
          importDisabledHint="Sélectionnez d'abord un type de document à gauche."
          onFileChange={handleFileChange}
          captureChamps={effectiveChamps}
          filledChampIds={filledChampIds}
          activeChampId={activeChampId}
          focusPageIndex={focusPageIndex}
          zoneAdjustMode={zoneAdjustMode && !ocrLoading}
          onZoneChange={handleZoneChange}
          onActiveChampChange={handleChampFocus}
          ocrLoading={showOcrLoading}
          ocrProgress={ocrProgress}
          onOcrCancel={showOcrLoading ? handleCancelOcr : undefined}
          {...annotationPreviewProps}
        />
      </div>
    </div>
  );

  const formPane = (
    <div ref={formPanelRef} className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="type-document-select" className="block text-sm font-medium text-gray-700 mb-1">
              Type de document <span className="text-red-500">*</span>
            </label>
            <select
              id="type-document-select"
              value={selectedTypeId}
              onChange={handleTypeChange}
              disabled={loadingTypes}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">— Choisir un type —</option>
              {typeDocuments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.libelle} ({t.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {isEditMode
                ? "Ajustez le fichier, les index et les annotations — à l'enregistrement, choisissez d'écraser ou de créer une nouvelle version."
                : "Importez un document à droite, vérifiez les zones si besoin, puis extrayez ou saisissez les champs manuellement."}
            </p>
          </div>
        </div>

        {selectedTypeId && (
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h4 className="text-sm font-semibold text-gray-800">Informations du document</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {canRunExtraction && (
                  <button
                    type="button"
                    onClick={handleRunExtraction}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Extraire les champs
                  </button>
                )}
                {!showOcrLoading && ocrFilledCount > 0 && (
                  <span className="text-xs text-emerald-600">
                    {ocrFilledCount} champ{ocrFilledCount > 1 ? "s" : ""} détecté{ocrFilledCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {loadingChamps ? (
              <p className="text-sm text-gray-500 py-8 text-center">Chargement des champs…</p>
            ) : showOcrLoading ? (
              <DocumentAnalysisLoading
                columnCount={formColumnCount}
                fileName={activeFile?.name}
                progress={ocrProgress}
                onCancel={handleCancelOcr}
              />
            ) : (
              <DocumentChampsForm
                champs={champs}
                values={fieldValues}
                errors={fieldErrors}
                onChange={handleFieldChange}
                onChampFocus={handleChampFocus}
                filledChampIds={filledChampIds}
                panelWidth={formPanelWidth}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  const pagesPanelContent = (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {isBatchMode && (
        <div className="flex gap-1 p-1.5 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setLeftSidebarTab("documents")}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
              leftSidebarTab === "documents"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            Lot ({batchActiveIndex + 1}/{batchItems.length})
          </button>
          <button
            type="button"
            onClick={() => setLeftSidebarTab("pages")}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
              leftSidebarTab === "pages"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            Pages
          </button>
        </div>
      )}

      {isBatchMode && leftSidebarTab === "documents" ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
          {batchItems.map((item, index) => {
            const isActive = index === batchActiveIndex;
            const displayItem =
              isActive && item.status !== "submitted"
                ? { ...item, fieldValues, zoneOverrides }
                : item;
            const ready = item.status !== "submitted" && isItemReady(displayItem, champs);
            return (
              <div key={item.id} className="group flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectBatchDocument(index)}
                  disabled={busy && !isActive}
                  className={`flex-1 min-w-0 flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-xs transition ${
                    isActive
                      ? "bg-emerald-100 text-emerald-900 font-medium"
                      : "text-slate-600 hover:bg-white"
                  } disabled:opacity-50`}
                  title={item.name}
                >
                  <span className="shrink-0 text-[10px] text-slate-400 w-4">{index + 1}</span>
                  <span className="truncate flex-1">{item.name}</span>
                  {item.status === "submitted" ? (
                    <span className="shrink-0 text-emerald-600 text-[10px]">✓</span>
                  ) : (
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`}
                    />
                  )}
                </button>
                {item.status !== "submitted" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFromBatch(index)}
                    disabled={busy}
                    className={`shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-40 ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    title="Retirer du lot"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 border-b border-slate-200 shrink-0 text-xs text-slate-500">
            {fichier ? `P. ${currentPage} / ${pageCount}` : "Pages"}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
            {loadingFile ? (
              <p className="text-xs text-slate-400 text-center py-4">Chargement…</p>
            ) : !fichier ? (
              <p className="text-xs text-slate-400 text-center py-4 px-2">Aucun document</p>
            ) : (
              Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => {
                const zoneCount = zoneCountByPage[num - 1] || 0;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => navigateToPageIndex(num - 1)}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md text-xs transition ${
                      currentPage === num
                        ? "bg-emerald-100 text-emerald-900 font-medium"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <span>P.{num}</span>
                    {zoneCount > 0 && (
                      <span className="ml-auto text-[10px] text-emerald-700">{zoneCount}z</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {fichier && (
        <div className="border-t border-slate-200 p-2 shrink-0 space-y-1.5">
          <WorkbenchUndoRedoButtons
            canUndo={workbenchHistory.canUndo}
            canRedo={workbenchHistory.canRedo}
            onUndo={handleWorkbenchUndo}
            onRedo={handleWorkbenchRedo}
            disabled={manipulationDisabled || !fichier}
            accent="emerald"
          />
          <div className="flex flex-wrap gap-1">
            <SidebarToolButton
              title="Ajouter des pages"
              disabled={manipulationDisabled}
              onClick={() => addPagesInputRef.current?.click()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </SidebarToolButton>
            <SidebarToolButton
              title="Supprimer la page"
              disabled={manipulationDisabled || pageCount <= 1}
              danger
              onClick={handleRemovePage}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </SidebarToolButton>
            <SidebarToolButton
              title="Rogner / Recadrer"
              disabled={manipulationDisabled}
              onClick={() => setShowCropModal(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </SidebarToolButton>
            {enableAppendDocuments && !isEditMode && fichier && (
              <SidebarToolButton
                title="Ajouter d'autres documents"
                disabled={manipulationDisabled || !selectedTypeId}
                onClick={() => batchImportInputRef.current?.click()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </SidebarToolButton>
            )}
            {!isBatchMode && (
              <>
                {!enableAppendDocuments && (
                  <SidebarToolButton
                    title="Importer par lot"
                    disabled={manipulationDisabled}
                    onClick={() => batchImportInputRef.current?.click()}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  </SidebarToolButton>
                )}
                <SidebarToolButton
                  title="Changer le document"
                  disabled={manipulationDisabled}
                  onClick={() => replaceFileInputRef.current?.click()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m-4 4V4" />
                  </svg>
                </SidebarToolButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const indexPanelContent = (
    <div className="flex flex-col h-full min-h-0" ref={formPanelRef}>
      <div className="px-4 py-3 border-b border-slate-100 shrink-0 space-y-3">
        <div>
          <label htmlFor="type-document-select-workbench" className="block text-xs font-medium text-slate-600 mb-1">
            Type de document <span className="text-red-500">*</span>
          </label>
          <select
            id="type-document-select-workbench"
            value={selectedTypeId}
            onChange={handleTypeChange}
            disabled={loadingTypes}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">— Choisir un type —</option>
            {typeDocuments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle} ({t.code})
              </option>
            ))}
          </select>
        </div>
        {isEditMode && documentToEdit && (
          <dl className="text-xs space-y-2 text-slate-600">
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-400">Fichier</dt>
              <dd className="font-medium text-right truncate max-w-[60%]" title={fichier?.name || documentToEdit.nom_fichier}>
                {fichier?.name || documentToEdit.nom_fichier || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-400">Pages</dt>
              <dd className="font-medium">{pageCount}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-400">Version courante</dt>
              <dd className="font-medium">v{versionCourante}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-400">Nombre de versions</dt>
              <dd className="font-medium">
                {versionsLoading ? "…" : Math.max(versionCourante, (documentVersions?.length || 0) + 1)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-400">Versions archivées</dt>
              <dd className="font-medium">{versionsLoading ? "…" : documentVersions?.length || 0}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">ID</dt>
              <dd className="font-medium">#{documentToEdit.id}</dd>
            </div>
          </dl>
        )}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">
              {isEditMode ? "Corrigez les valeurs si nécessaire." : "Saisissez ou extrayez les champs."}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1 shrink-0">
            {canRunExtraction && (
              <button
                type="button"
                onClick={handleRunExtraction}
                disabled={manipulationDisabled}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Extraire
              </button>
            )}
            {hasConfigurableZones && selectedTypeId && !loadingChamps && (
              <button
                type="button"
                onClick={handleToggleZones}
                disabled={manipulationDisabled || !fichier}
                className={`inline-flex items-center justify-center px-3 py-1 text-[11px] font-medium rounded-lg border transition disabled:opacity-40 ${
                  showZonesMode
                    ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {showZonesMode ? "Masquer zones" : "Voir zones"}
              </button>
            )}
          </div>
        </div>
        {!showOcrLoading && ocrFilledCount > 0 && (
          <p className="text-xs text-emerald-600">
            {ocrFilledCount} champ{ocrFilledCount > 1 ? "s" : ""} détecté{ocrFilledCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {isCurrentBatchItemSubmitted && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
            Document déjà soumis — consultation seule.
          </div>
        )}
        {!selectedTypeId ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Choisissez un type de document ci-dessus pour afficher les champs.
          </p>
        ) : loadingChamps ? (
          <p className="text-sm text-slate-400 text-center py-8">Chargement des champs…</p>
        ) : showOcrLoading ? (
          <DocumentAnalysisLoading
            columnCount={formPanelWidth >= 680 ? 2 : 1}
            fileName={fichier?.name}
            progress={ocrProgress}
            onCancel={handleCancelOcr}
          />
        ) : (
          <div className={isCurrentBatchItemSubmitted ? "pointer-events-none opacity-60" : undefined}>
            <DocumentChampsForm
              champs={champs}
              values={fieldValues}
              errors={fieldErrors}
              onChange={handleFieldChange}
              onChampFocus={handleChampFocus}
              filledChampIds={filledChampIds}
              panelWidth={formPanelWidth}
            />
          </div>
        )}
      </div>
    </div>
  );

  const annotationsPanelContent = (
    <div className="p-4 space-y-3">
      <p className="text-xs text-slate-500">
        Choisissez un outil puis interagissez sur le document au centre.
      </p>
      <AnnotationToolbar
        activeTool={annotationTool}
        onToolChange={handleAnnotationToolChange}
        activeColor={annotationColor}
        onColorChange={handleAnnotationColorChange}
        onUndo={handleAnnotationUndo}
        onRedo={handleAnnotationRedo}
        onClearPage={handleAnnotationClearPage}
        onDeleteSelected={handleDeleteSelectedAnnotation}
        canUndo={workbenchHistory.canUndo}
        canRedo={workbenchHistory.canRedo}
        canDeleteSelected={Boolean(selectedAnnotationId)}
      />
      <p className="text-[11px] text-slate-500">
        Cliquez un élément déjà placé pour le sélectionner, le déplacer, le redimensionner ou le
        pivoter. Bouton rouge × ou Suppr pour le supprimer. Double-clic sur un texte pour le
        modifier.
      </p>
    </div>
  );

  const stampsPanelContent = (
    <StampsManagePanel
      selectedId={selectedStampId}
      selectedColor={selectedStampColor}
      onSelect={handleSelectStamp}
      onColorChange={setSelectedStampColor}
      onNotify={onNotify}
    />
  );

  const signaturesPanelContent = (
    <SignaturesManagePanel
      signatures={userSignatures}
      selectedId={selectedSignatureId}
      onSelect={handleSelectSignature}
      onRefresh={refreshUserSignatures}
      username={signatureUsername}
      onNotify={onNotify}
    />
  );

  const notesPanelContent = (
    <NotesManagePanel
      documentId={documentToEdit?.id}
      canComment={hasPermission(PERMISSIONS.COMMENTER_DOCUMENT)}
      onNotify={onNotify}
    />
  );

  const versionsPanelContent = isEditMode ? (
    <DocumentVersionsPanel
      documentId={documentToEdit?.id}
      versions={documentVersions}
      versionCourante={versionCourante}
      loading={versionsLoading}
      onViewVersion={setVersionPreview}
    />
  ) : null;

  const railItems = [
    {
      id: "index",
      label: "Type & champs d'index",
      icon: (
        <RailIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h10M4 18h14" />
          </svg>
        </RailIcon>
      ),
    },
    ...(isEditMode
      ? [
          hasPermission(PERMISSIONS.ANNOTER_DOCUMENT) && {
            id: "annotations",
            label: "Annotations",
            icon: (
              <RailIcon>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </RailIcon>
            ),
          },
          hasPermission(PERMISSIONS.TAMPONNER_DOCUMENT) && {
            id: "stamps",
            label: "Tampons",
            icon: (
              <RailIcon>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </RailIcon>
            ),
          },
          hasPermission(PERMISSIONS.SIGNER_DOCUMENT) && {
            id: "signatures",
            label: "Signatures",
            icon: (
              <RailIcon>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3zM4 20h7" />
                </svg>
              </RailIcon>
            ),
          },
          hasPermission(PERMISSIONS.COMMENTER_DOCUMENT) && {
            id: "notes",
            label: "Commentaires",
            icon: (
              <RailIcon>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </RailIcon>
            ),
          },
          {
            id: "versions",
            label: "Historique des versions",
            icon: (
              <RailIcon>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </RailIcon>
            ),
          },
        ].filter(Boolean)
      : []),
  ];

  const railPanelMap = {
    index: { title: "Type & champs d'index", content: indexPanelContent },
    annotations: { title: "Annotations", content: annotationsPanelContent },
    stamps: { title: "Tampons", content: stampsPanelContent },
    signatures: { title: "Signatures", content: signaturesPanelContent },
    notes: { title: "Commentaires", content: notesPanelContent },
    versions: { title: "Historique des versions", content: versionsPanelContent },
  };
  const activeRail = railPanelMap[rightRailPanel] || null;

  const containerClass = fullPage
    ? "bg-white rounded-xl shadow-md border border-emerald-200 overflow-hidden flex flex-col flex-1 min-h-0 h-full"
    : "mt-6 bg-white rounded-lg shadow-sm border border-emerald-200 overflow-hidden";

  return (
    <div className={containerClass}>
      {fullPage && pendingPdfFile && (
        <AddPagesFromFileModal
          file={pendingPdfFile}
          onConfirm={handlePdfPagesConfirm}
          onCancel={handlePdfPagesCancel}
        />
      )}

      {fullPage && showCropModal && fichier && (
        <PageCropModal
          file={fichier}
          pageIndex={currentPage - 1}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropModal(false)}
        />
      )}

      <DocumentSaveModeModal
        open={showSaveModeModal}
        busy={submitting}
        versionCourante={versionCourante}
        onClose={() => setShowSaveModeModal(false)}
        onConfirm={async (saveMode) => {
          try {
            setSubmitting(true);
            await performEditSave(saveMode);
            setShowSaveModeModal(false);
          } catch (err) {
            onNotify?.(err.message || "Erreur lors de l'enregistrement", "error");
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <DocumentVersionPreviewModal
        open={Boolean(versionPreview)}
        version={versionPreview}
        documentId={documentToEdit?.id}
        onClose={() => setVersionPreview(null)}
      />

      <div
        className={`flex items-center justify-between px-6 py-4 text-white shrink-0 ${
          isEditMode
            ? "bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600"
            : "bg-emerald-600"
        }`}
      >
        <div>
          <h3 className="text-xl font-semibold">
            {isEditMode ? "Modifier le document" : "Rattacher un document"}
          </h3>
          <p className="text-sm mt-1 text-emerald-100">
            {localite.niveau_libelle} — <strong>{localite.libelle}</strong>
          </p>
          {fullPage && isEditMode && documentToEdit && (
            <p className="text-xs mt-0.5 text-emerald-100/90">
              Document #{documentToEdit.id} — {documentToEdit.type_document_libelle} — v
              {versionCourante}
            </p>
          )}
          {!isEditMode && fullPage && isBatchMode && (
            <p className="text-xs mt-0.5 text-emerald-100/90">
              Lot {batchActiveIndex + 1}/{batchItems.length}
              {fichier?.name ? ` — ${fichier.name}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetour}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm hover:bg-emerald-700/80"
            title={isEditMode ? "Retour à la liste" : "Retour au plan géographique"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {fullPage ? "Retour" : ""}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {fullPage ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
              {pagesPanelContent}
            </aside>

            <div className="flex-1 min-w-0 min-h-0 bg-slate-100 p-3 flex flex-col">
              {loadingFile ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  Chargement du document…
                </div>
              ) : !fichier ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-3 px-4 text-center">
                  <p>
                    {selectedTypeId
                      ? "Importez un ou plusieurs documents pour commencer."
                      : "Choisissez d'abord un type de document (panneau de droite)."}
                  </p>
                  {selectedTypeId && (
                    <button
                      type="button"
                      onClick={() => batchImportInputRef.current?.click()}
                      disabled={manipulationDisabled}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Importer le document
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {hasZonesOnOtherPages && (
                    <div className="shrink-0 mb-2 px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                      Aucune zone sur cette page — choisissez une page marquée à gauche.
                    </div>
                  )}
                  <DocumentPreview
                    key={filePreviewKey}
                    file={fichier}
                    large
                    zoomable
                    pageNumber={currentPage}
                    onPageChange={handlePreviewPageChange}
                    focusPageIndex={focusPageIndex}
                    showCaptureZones={showZonesMode}
                    captureChamps={effectiveChamps}
                    filledChampIds={filledChampIds}
                    activeChampId={activeChampId}
                    zoneAdjustMode={showZonesMode && !ocrLoading}
                    onZoneChange={handleZoneChange}
                    onActiveChampChange={handleChampFocus}
                    ocrLoading={ocrLoading}
                    ocrProgress={ocrProgress}
                    onOcrCancel={ocrLoading ? handleCancelOcr : undefined}
                    zonePageControls={{
                      visible: showZonesMode && zoneChamps.length > 0,
                      zoneChamps,
                      activeChampId,
                      activeChamp: activeZoneChamp,
                      pageCount,
                      currentPage,
                      onChampSelect: handleSelectZoneChamp,
                      onNextChamp: handleNextZoneChamp,
                      onPageSelect: handleActiveZonePageSelect,
                      onAssignCurrentPage: handleAssignZoneToCurrentPage,
                      accent: "emerald",
                    }}
                    {...annotationPreviewProps}
                  />
                </>
              )}
            </div>

            <WorkbenchIconRail
              items={railItems}
              activeId={rightRailPanel}
              onSelect={handleRightRailSelect}
              panelTitle={activeRail?.title || ""}
              panelContent={activeRail?.content || null}
              accent="emerald"
            />

            <input
              ref={replaceFileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={handleReplaceDocument}
            />
            <input
              ref={batchImportInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              multiple
              className="hidden"
              onChange={handleBatchImport}
            />
            <input
              ref={addPagesInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              multiple
              className="hidden"
              onChange={handleAddPages}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 lg:items-stretch lg:max-h-[min(720px,calc(100vh-14rem))]">
            <div className="min-h-[280px] lg:min-h-0 lg:h-full lg:overflow-hidden">{formPane}</div>
            <div className="min-h-[320px] lg:min-h-0 lg:h-full lg:overflow-hidden">{previewPane}</div>
          </div>
        )}

        <div
          className={`flex justify-end gap-3 shrink-0 ${
            fullPage ? "px-6 py-4 border-t border-gray-100 bg-white" : "px-6 pb-6 pt-4 border-t border-gray-100"
          }`}
        >
          <button
            type="button"
            onClick={handleAbandon}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            Annuler
          </button>
          {!isEditMode && fullPage && isBatchMode && (
            <button
              type="button"
              disabled={
                busy ||
                !selectedTypeId ||
                !activeFile ||
                batchActiveIndex >= batchItems.length - 1
              }
              onClick={handleNextBatchDocument}
              className="px-4 py-2 border border-emerald-400 text-emerald-800 bg-emerald-50 rounded-lg text-sm font-medium hover:bg-emerald-100 transition disabled:opacity-50"
            >
              Document suivant
            </button>
          )}
          {!isEditMode && fullPage && !isBatchMode && (
            <button
              type="button"
              disabled={busy || !selectedTypeId || !activeFile}
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 border border-emerald-400 text-emerald-800 bg-emerald-50 rounded-lg text-sm font-medium hover:bg-emerald-100 transition disabled:opacity-50"
            >
              {submitting ? "Enregistrement…" : "Soumettre et passer au suivant"}
            </button>
          )}
          <button
            type="submit"
            disabled={
              busy ||
              !selectedTypeId ||
              (!isEditMode && !activeFile) ||
              (isBatchMode && pendingBatchCount === 0)
            }
            className={`px-5 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition ${
              isEditMode
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300"
            }`}
          >
            {ocrLoading
              ? `Analyse ${ocrProgress}%`
              : batchSubmitProgress
                ? `Soumission ${batchSubmitProgress.current}/${batchSubmitProgress.total}…`
                : submitting
                  ? "Enregistrement…"
                  : processing
                    ? "Traitement…"
                    : isEditMode
                      ? "Enregistrer les modifications"
                      : isBatchMode
                        ? `Soumettre le lot à validation (${pendingBatchCount})`
                        : "Soumettre à validation"}
          </button>
        </div>
      </form>
    </div>
  );
}
