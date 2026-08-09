/**
 * Panneau de contrôle qualité — vérification des métadonnées et manipulation des pages
 * sur un document déjà enregistré (style Dockmee).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentPreview from "../gestion_documentaire/documents/DocumentPreview";
import DocumentChampsForm from "../gestion_documentaire/documents/DocumentChampsForm";
import { getChampsDocuments } from "../../services/champsDocument.service";
import { extractDocumentFields } from "../../services/ocr.service";
import { getLocalitesDernierNiveau } from "../../services/group.service";
import { getOrderedNextCasiers, normalizeBucket } from "../../utils/controleQualiteBuckets";
import {
  fetchDocumentFileBlob,
  getDocumentsParLocalite,
  soumettreControleQualite,
  updateDocumentLocalite,
  validerControleQualite,
  rejeterControleQualite,
} from "../../services/documentLocalite.service";
import {
  STATUT_EN_ATTENTE,
  STATUT_REJETE,
  STATUT_VALIDE,
  canSoumettreValidation,
  canValiderOuRejeter,
  getStatutLabel,
} from "@/utils/documentStatutQualite";
import { useControleQualitePermissions } from "../../utils/controleQualitePermissions";
import { normalizeDatetimeLocalValue } from "../../utils/dateFormat";
import { normalizeAnnotations } from "@/utils/pdfAnnotationUtils";
import {
  appendSelectedPagesToPdf,
  buildDocumentFile,
  cropPdfPage,
  getPdfPageCount,
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
import AddPagesFromFileModal from "./AddPagesFromFileModal";
import PageCropModal from "./PageCropModal";
import DocumentAnalysisLoading from "../gestion_documentaire/documents/DocumentAnalysisLoading";
import WorkbenchUndoRedoButtons from "../gestion_documentaire/documents/WorkbenchUndoRedoButtons";
import { useDocumentWorkbenchHistory } from "@/hooks/useDocumentWorkbenchHistory";

const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf";
const FILTER_ACCESS = true;

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
          : "hover:bg-yellow-50 hover:text-yellow-800 hover:border-yellow-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function DocumentControleQualitePanel({
  localite,
  document,
  queueStatut = null,
  onNavigateDocument,
  onClose,
  onValidated,
  onNotify,
}) {
  const addPagesInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const formPanelRef = useRef(null);
  const ocrRequestIdRef = useRef(0);
  const ocrAbortRef = useRef(null);
  const workbenchHistory = useDocumentWorkbenchHistory();
  const { resetHistory, createSnapshot } = workbenchHistory;

  const [fichier, setFichier] = useState(null);
  const [champs, setChamps] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formPanelWidth, setFormPanelWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fileModified, setFileModified] = useState(false);
  const [filePreviewKey, setFilePreviewKey] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const [pendingPdfQueue, setPendingPdfQueue] = useState([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [filledChampIds, setFilledChampIds] = useState([]);
  const [ocrFilledCount, setOcrFilledCount] = useState(0);
  const [showZonesMode, setShowZonesMode] = useState(false);
  const [zoneOverrides, setZoneOverrides] = useState({});
  const [activeChampId, setActiveChampId] = useState(null);
  const [focusPageIndex, setFocusPageIndex] = useState(null);
  const [queueDocuments, setQueueDocuments] = useState([]);
  const [leftSidebarTab, setLeftSidebarTab] = useState("pages");
  const [casierCompleteModal, setCasierCompleteModal] = useState(null);

  const queueActiveIndex = useMemo(
    () => queueDocuments.findIndex((doc) => doc.id === document.id),
    [queueDocuments, document.id]
  );
  const isValidationMode = queueStatut === STATUT_EN_ATTENTE;
  const hasQueue = queueDocuments.length > 1;
  const showDocumentQueue = hasQueue && !isValidationMode;
  const queuePosition = queueActiveIndex >= 0 ? queueActiveIndex + 1 : 1;

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

  const documentAnnotations = useMemo(
    () => normalizeAnnotations(document.annotations),
    [document.annotations]
  );

  const navigateToPageIndex = useCallback((pageIndex0) => {
    setFocusPageIndex(pageIndex0);
    setCurrentPage(pageIndex0 + 1);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [champsData, fileData] = await Promise.all([
          getChampsDocuments(document.type_document),
          fetchDocumentFileBlob(document.fichier_url),
        ]);
        if (cancelled) return;

        const sorted = Array.isArray(champsData) ? champsData.sort((a, b) => a.ordre - b.ordre) : [];
        setChamps(sorted);

        const initial = {};
        sorted.forEach((c) => {
          const fromDoc = document.valeurs?.find((v) => v.champ_id === c.id);
          let valeur = fromDoc?.valeur ?? "";
          if (c.type_champ === "datetime") {
            valeur = normalizeDatetimeLocalValue(valeur);
          }
          initial[c.id] = valeur;
        });
        setFieldValues(initial);

        const loadedFile = buildDocumentFile(fileData.blob, {
          url: document.fichier_url,
          fallbackName: `document-${document.id || "qc"}`,
        });
        if (cancelled) return;

        setFichier(loadedFile);
        const count = await getPdfPageCount(loadedFile);
        setPageCount(count);
        setFileModified(false);
        await resetHistory(
          await createSnapshot({
            fichier: loadedFile,
            zoneOverrides: {},
            currentPage: 1,
          })
        );
      } catch (err) {
        onNotify?.(err.message || "Impossible de charger le document", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document.id, document.fichier_url, document.type_document, onNotify, resetHistory, createSnapshot]);

  useEffect(() => {
    if (!localite?.id || !queueStatut) {
      setQueueDocuments([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await getDocumentsParLocalite(localite.id, {
          statutQualite: queueStatut,
          limit: 200,
        });
        if (!cancelled) {
          setQueueDocuments(Array.isArray(res?.results) ? res.results : []);
        }
      } catch {
        if (!cancelled) setQueueDocuments([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [localite?.id, queueStatut]);

  useEffect(() => {
    if (isValidationMode) {
      setLeftSidebarTab("pages");
      return;
    }
    setLeftSidebarTab(queueDocuments.length > 1 ? "queue" : "pages");
  }, [queueDocuments.length, document.id, isValidationMode]);

  const handleSelectQueueDocument = useCallback(
    (docId) => {
      if (!docId || docId === document.id) return;
      onNavigateDocument?.(docId);
    },
    [document.id, onNavigateDocument]
  );

  const fetchNextCasierTarget = useCallback(async () => {
    if (!localite?.id || !queueStatut) return null;
    try {
      const { results } = await getLocalitesDernierNiveau("", FILTER_ACCESS, {
        statutQualite: queueStatut,
      });
      const candidates = getOrderedNextCasiers(results, localite.id);
      if (!candidates.length) return null;

      const withCountHint = candidates.filter((c) => Number(c.nb_documents || 0) > 0);
      const toScan = withCountHint.length ? withCountHint : candidates;

      for (const candidate of toScan) {
        const res = await getDocumentsParLocalite(candidate.id, {
          statutQualite: queueStatut,
          limit: 200,
        });
        const docs = res?.results || [];
        if (!docs.length) continue;
        const docCount = Number(res?.total) || docs.length;
        const bucket = normalizeBucket(candidate);
        return {
          nextCasierId: bucket.id,
          nextCasierLabel: bucket.libelle || bucket.code || `Casier #${bucket.id}`,
          nextCasierCode: bucket.code || "",
          nextCasierDocCount: docCount,
          nextDocumentId: docs[0].id,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [localite?.id, queueStatut]);

  const navigateAfterQueueAction = useCallback(
    async (result) => {
      const nextDocInCasier =
        queueActiveIndex >= 0 && queueActiveIndex < queueDocuments.length - 1
          ? queueDocuments[queueActiveIndex + 1]
          : queueActiveIndex < 0
            ? queueDocuments.find((doc) => Number(doc.id) !== Number(document.id)) || null
            : null;

      if (nextDocInCasier && Number(nextDocInCasier.id) !== Number(document.id)) {
        onValidated?.(result, { goNext: true, nextDocumentId: nextDocInCasier.id });
        return;
      }

      const nextCasierTarget = await fetchNextCasierTarget();
      if (nextCasierTarget) {
        setCasierCompleteModal({ result, ...nextCasierTarget });
        return;
      }

      onValidated?.(result, { allComplete: true });
    },
    [
      queueActiveIndex,
      queueDocuments,
      document.id,
      fetchNextCasierTarget,
      onValidated,
    ]
  );

  const handleAcceptNextCasier = useCallback(() => {
    if (!casierCompleteModal) return;
    const { result, nextCasierId, nextDocumentId, nextCasierLabel, nextCasierCode, nextCasierDocCount } =
      casierCompleteModal;
    setCasierCompleteModal(null);
    onValidated?.(result, {
      goNextCasier: true,
      nextCasierId,
      nextDocumentId,
      nextCasierLabel,
      nextCasierCode,
      nextCasierDocCount,
    });
  }, [casierCompleteModal, onValidated]);

  const handleDeclineNextCasier = useCallback(() => {
    if (!casierCompleteModal) return;
    const { result } = casierCompleteModal;
    setCasierCompleteModal(null);
    onValidated?.(result, { casierComplete: true });
  }, [casierCompleteModal, onValidated]);

  useEffect(() => {
    const el = formPanelRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      setFormPanelWidth(entries[0]?.contentRect?.width ?? 0);
    });
    observer.observe(el);
    setFormPanelWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const refreshPageCount = useCallback(async (file) => {
    const count = await getPdfPageCount(file);
    let nextPage = 1;
    setPageCount(count);
    setCurrentPage((p) => {
      nextPage = Math.min(p, count || 1);
      return nextPage;
    });
    return nextPage;
  }, []);

  const applyWorkbenchSnapshot = useCallback(
    async (snapshot) => {
      if (!snapshot?.fichier) return;
      setFichier(snapshot.fichier);
      setZoneOverrides(snapshot.zoneOverrides || {});
      const page = snapshot.currentPage ?? 1;
      setCurrentPage(page);
      setFocusPageIndex(page - 1);
      setFileModified(true);
      setFilePreviewKey((k) => k + 1);
      await refreshPageCount(snapshot.fichier);
    },
    [refreshPageCount]
  );

  const commitWorkbenchState = useCallback(
    async ({ fichier: file, zoneOverrides: overrides, currentPage: page }) => {
      if (!file) return;
      await workbenchHistory.commitSnapshot(
        await createSnapshot({
          fichier: file,
          zoneOverrides: overrides ?? {},
          currentPage: page ?? 1,
        })
      );
    },
    [workbenchHistory, createSnapshot]
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
  }, [handleWorkbenchUndo, handleWorkbenchRedo]);

  const applyFileUpdate = useCallback(
    async (newFile, successMessage, historyState = null) => {
      setProcessing(true);
      try {
        setFichier(newFile);
        setFileModified(true);
        setFilePreviewKey((k) => k + 1);
        const nextPage = await refreshPageCount(newFile);
        onNotify?.(successMessage, "success");
        await commitWorkbenchState(
          historyState ?? {
            fichier: newFile,
            zoneOverrides,
            currentPage: nextPage,
          }
        );
      } catch (err) {
        onNotify?.(err.message || "Erreur lors de la manipulation du document", "error");
      } finally {
        setProcessing(false);
      }
    },
    [onNotify, refreshPageCount, commitWorkbenchState, zoneOverrides]
  );

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

  const handlePreviewPageChange = useCallback((pageNum) => {
    setCurrentPage(pageNum);
    setFocusPageIndex(pageNum - 1);
  }, []);

  const handleZoneChange = useCallback(
    async (champId, patch) => {
      const nextOverrides = {
        ...zoneOverrides,
        [champId]: { ...(zoneOverrides[champId] || {}), ...patch },
      };
      setZoneOverrides(nextOverrides);
      if (fichier) {
        await commitWorkbenchState({
          fichier,
          zoneOverrides: nextOverrides,
          currentPage,
        });
      }
    },
    [zoneOverrides, fichier, currentPage, commitWorkbenchState]
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
        await commitWorkbenchState({
          fichier: updated,
          zoneOverrides,
          currentPage: nextPage,
        });
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
      await commitWorkbenchState({
        fichier: updated,
        zoneOverrides,
        currentPage: nextPage,
      });
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

  const handleReplaceDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setProcessing(true);
    try {
      // Conserve le format d'origine (JPG/PNG/…) ; conversion PDF uniquement si manipulation multi-pages.
      setFichier(file);
      setFileModified(true);
      setFilePreviewKey((k) => k + 1);
      setCurrentPage(1);
      setFocusPageIndex(0);
      setZoneOverrides({});
      setShowZonesMode(false);
      setActiveChampId(null);
      setFilledChampIds([]);
      setOcrFilledCount(0);
      await refreshPageCount(file);
      await workbenchHistory.resetHistory(
        await workbenchHistory.createSnapshot({
          fichier: file,
          zoneOverrides: {},
          currentPage: 1,
        })
      );
      onNotify?.("Document remplacé — vérifiez l'aperçu et les index.", "success");
    } catch (err) {
      onNotify?.(err.message || "Impossible de charger le fichier", "error");
    } finally {
      setProcessing(false);
    }
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

  const handleCancelOcr = useCallback(() => {
    ocrAbortRef.current?.();
    ocrRequestIdRef.current += 1;
    setOcrLoading(false);
    setOcrProgress(0);
    onNotify?.("Extraction annulée.", "info");
  }, [onNotify]);

  const runOcrExtraction = useCallback(async () => {
    if (!fichier || !document.type_document || !champs.length || document.statut_qualite === STATUT_VALIDE) return;

    const requestId = ++ocrRequestIdRef.current;
    const overridePayload = zoneOverridesToPayload(zoneOverrides);
    try {
      setOcrLoading(true);
      setOcrProgress(0);
      const result = await extractDocumentFields({
        fichier,
        typeDocumentId: Number(document.type_document),
        zoneOverrides: overridePayload.length ? overridePayload : undefined,
        abortRef: ocrAbortRef,
        onProgress: (percent) => {
          if (requestId === ocrRequestIdRef.current) setOcrProgress(percent);
        },
      });

      if (requestId !== ocrRequestIdRef.current) return;

      const extracted = Array.isArray(result?.champs) ? result.champs : [];
      const actuallyFilledIds = [];

      if (!extracted.length) {
        setFilledChampIds([]);
        setOcrFilledCount(0);
        if (result?.compatibilite?.message) {
          onNotify?.(result.compatibilite.message, "warning");
        } else {
          onNotify?.("Document analysé — aucun champ détecté.", "info");
        }
        return;
      }

      const nextValues = { ...fieldValues };
      extracted.forEach(({ champ_id, valeur }) => {
        if (valeur == null || String(valeur).trim() === "") return;
        const champ = champs.find((c) => c.id === champ_id);
        const normalized =
          champ?.type_champ === "datetime"
            ? normalizeDatetimeLocalValue(valeur)
            : String(valeur);
        if (String(normalized).trim() === "") return;
        nextValues[champ_id] = normalized;
        actuallyFilledIds.push(champ_id);
      });
      setFieldValues(nextValues);
      setFilledChampIds(actuallyFilledIds);
      setOcrFilledCount(actuallyFilledIds.length);

      if (!actuallyFilledIds.length) {
        onNotify?.("Aucune valeur extraite des zones.", "info");
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
                : methode === "pdf_native" || methode === "pdf_native_zone" || methode.startsWith("pdf_native")
                  ? "extraction PDF"
                  : methode.includes("qr") || methode.includes("code_barre")
                    ? "OCR + décodage"
                    : "OCR";
      onNotify?.(
        `${actuallyFilledIds.length} champ${actuallyFilledIds.length > 1 ? "s" : ""} mis à jour (${methodeLabel}). Vérifiez les valeurs.`,
        "success"
      );
    } catch (err) {
      if (requestId !== ocrRequestIdRef.current) return;
      if (err.cancelled) return;
      if (!err.ocrUnavailable) {
        onNotify?.(err.message || "Erreur lors de l'extraction", "error");
      } else {
        onNotify?.("OCR indisponible — saisissez les champs manuellement.", "info");
      }
    } finally {
      if (requestId === ocrRequestIdRef.current) {
        setOcrLoading(false);
        setOcrProgress(0);
      }
    }
  }, [fichier, document.type_document, champs, fieldValues, zoneOverrides, onNotify]);

  const submitValidation = async () => {
    if (!validateFields()) {
      onNotify?.("Corrigez les champs obligatoires avant validation", "error");
      return false;
    }

    try {
      setSubmitting(true);
      const valeurs = champs.map((champ) => ({
        champ_id: champ.id,
        valeur: String(fieldValues[champ.id] ?? ""),
      }));

      await validerControleQualite(document.id, {
        fichier: fileModified ? fichier : undefined,
        valeurs,
      });

      return true;
    } catch (err) {
      onNotify?.(err.message || "Erreur lors de la validation", "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (e) => {
    e.preventDefault();
    if (!(await submitValidation())) return;
    const stillHasNextInCasier =
      queueActiveIndex >= 0 && queueActiveIndex < queueDocuments.length - 1;
    if (stillHasNextInCasier) {
      onValidated?.("valide");
      return;
    }
    await navigateAfterQueueAction("valide");
  };

  const handleValidateAndNext = async () => {
    if (!(await submitValidation())) return;
    await navigateAfterQueueAction("valide");
  };

  const handleEnregistrer = async () => {
    try {
      setSubmitting(true);
      const valeurs = champs.map((champ) => ({
        champ_id: champ.id,
        valeur: String(fieldValues[champ.id] ?? ""),
      }));

      await updateDocumentLocalite(document.id, {
        fichier: fileModified ? fichier : undefined,
        valeurs,
      });

      setFileModified(false);
      setFilePreviewKey((k) => k + 1);
      onNotify?.("Brouillon enregistré — vous pouvez continuer plus tard.", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSoumission = async () => {
    if (!validateFields()) {
      onNotify?.("Corrigez les champs obligatoires avant soumission", "error");
      return false;
    }

    try {
      setSubmitting(true);
      const valeurs = champs.map((champ) => ({
        champ_id: champ.id,
        valeur: String(fieldValues[champ.id] ?? ""),
      }));

      await soumettreControleQualite(document.id, {
        fichier: fileModified ? fichier : undefined,
        valeurs,
      });

      return true;
    } catch (err) {
      onNotify?.(err.message || "Erreur lors de la soumission", "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSoumettre = async () => {
    if (!(await submitSoumission())) return;
    const stillHasNextInCasier =
      queueActiveIndex >= 0 && queueActiveIndex < queueDocuments.length - 1;
    if (stillHasNextInCasier) {
      onValidated?.("soumis");
      return;
    }
    await navigateAfterQueueAction("soumis");
  };

  const handleSoumettreAndNext = async () => {
    if (!(await submitSoumission())) return;
    await navigateAfterQueueAction("soumis");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (modeControle) return handleValidate(e);
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      await rejeterControleQualite(document.id, { motifRejet });
      setShowRejectModal(false);
      setMotifRejet("");
      await navigateAfterQueueAction("rejete");
    } catch (err) {
      onNotify?.(err.message || "Erreur lors du rejet", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = processing || loading || submitting || ocrLoading;
  const canExtract = Boolean(fichier) && champs.length > 0 && !ocrLoading && !loading;
  const statut = document.statut_qualite || "brouillon";
  const qc = useControleQualitePermissions();
  const modeControle = canValiderOuRejeter(statut) && (qc.canValider || qc.canRejeter);
  const modeCorrection = canSoumettreValidation(statut) && qc.canPrepare;
  const modeConsultation =
    statut === STATUT_VALIDE ||
    (canValiderOuRejeter(statut) && !qc.canValider && !qc.canRejeter) ||
    (canSoumettreValidation(statut) && !qc.canPrepare);
  const manipulationDisabled = busy || modeConsultation || !qc.canPrepare;
  const zonesOnCurrentPage = filterZonesForPage(effectiveChamps, currentPage - 1).length;
  const hasZonesOnOtherPages =
    showZonesMode &&
    hasConfigurableZones &&
    zonesOnCurrentPage === 0 &&
    Object.keys(zoneCountByPage).length > 0;

  return (
    <div className="bg-white rounded-xl shadow-md border border-yellow-200 overflow-hidden flex flex-col flex-1 min-h-0 h-full">
      {casierCompleteModal && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-yellow-200">
            <div
              className={`px-5 py-4 border-b ${
                casierCompleteModal.result === "rejete"
                  ? "border-red-100 bg-gradient-to-r from-red-50 to-orange-50"
                  : "border-yellow-100 bg-gradient-to-r from-yellow-50 to-amber-50"
              }`}
            >
              <h3 className="text-base font-semibold text-slate-800">
                {casierCompleteModal.result === "rejete"
                  ? "Document rejeté"
                  : casierCompleteModal.result === "soumis"
                    ? "Document soumis"
                    : "Casier terminé"}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {casierCompleteModal.result === "rejete"
                  ? "Ce casier ne contient plus de documents en attente."
                  : casierCompleteModal.result === "soumis"
                    ? "Ce casier ne contient plus de documents rejetés."
                    : "Tous les documents de ce casier ont été traités."}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Voulez-vous passer au lot{" "}
                <strong className="text-yellow-800">
                  {casierCompleteModal.nextCasierCode || casierCompleteModal.nextCasierLabel}
                </strong>
                {casierCompleteModal.nextCasierLabel &&
                  casierCompleteModal.nextCasierCode &&
                  casierCompleteModal.nextCasierLabel !== casierCompleteModal.nextCasierCode && (
                    <span className="text-slate-600"> — {casierCompleteModal.nextCasierLabel}</span>
                  )}{" "}
                avec <strong>{casierCompleteModal.nextCasierDocCount}</strong> document
                {casierCompleteModal.nextCasierDocCount > 1 ? "s" : ""} à traiter ?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDeclineNextCasier}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
              >
                Retour à la liste
              </button>
              <button
                type="button"
                onClick={handleAcceptNextCasier}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                  casierCompleteModal.result === "rejete"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                    : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                }`}
              >
                Passer au lot suivant
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-red-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">Rejeter le document</h3>
              <p className="text-xs text-slate-500 mt-1">Indiquez un motif (optionnel).</p>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300"
                placeholder="Motif du rejet…"
              />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPdfFile && (
        <AddPagesFromFileModal
          file={pendingPdfFile}
          onConfirm={handlePdfPagesConfirm}
          onCancel={handlePdfPagesCancel}
        />
      )}

      {showCropModal && fichier && (
        <PageCropModal
          file={fichier}
          pageIndex={currentPage - 1}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropModal(false)}
        />
      )}

      <div className="flex items-center justify-between px-6 py-4 text-white shrink-0 bg-gradient-to-r from-yellow-500 via-yellow-500 to-amber-500">
        <div>
          <h3 className="text-xl font-semibold">
            {modeControle ? "Contrôle qualité" : modeCorrection ? "Contrôle — brouillon" : "Consultation"}
          </h3>
          <p className="text-sm mt-1 text-yellow-100">
            {localite.niveau_libelle} — <strong>{localite.libelle}</strong>
          </p>
          <p className="text-xs mt-0.5 text-yellow-100/90">
            Document #{document.id} — {document.type_document_libelle} — {getStatutLabel(statut)}
            {hasQueue ? ` — File ${queuePosition}/${queueDocuments.length}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm hover:bg-yellow-600/80"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour
        </button>
      </div>

      {statut === STATUT_REJETE && document.motif_rejet && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-100 text-sm text-red-800 shrink-0">
          <strong>Motif du rejet :</strong> {document.motif_rejet}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            {showDocumentQueue && (
              <div className="flex gap-1 p-1.5 border-b border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftSidebarTab("queue")}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    leftSidebarTab === "queue"
                      ? "bg-yellow-500 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  File ({queuePosition}/{queueDocuments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeftSidebarTab("pages")}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    leftSidebarTab === "pages"
                      ? "bg-yellow-500 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Pages
                </button>
              </div>
            )}

            {showDocumentQueue && leftSidebarTab === "queue" ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
                {queueDocuments.map((doc, index) => {
                  const isActive = doc.id === document.id;
                  const label = doc.type_document_libelle || `Document #${doc.id}`;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleSelectQueueDocument(doc.id)}
                      disabled={busy && !isActive}
                      className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-xs transition ${
                        isActive
                          ? "bg-yellow-100 text-yellow-900 font-medium"
                          : "text-slate-600 hover:bg-white"
                      } disabled:opacity-50`}
                      title={label}
                    >
                      <span className="shrink-0 text-[10px] text-slate-400 w-4">{index + 1}</span>
                      <span className="truncate flex-1">{label}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">#{doc.id}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="px-3 py-1.5 border-b border-slate-200 shrink-0 text-xs text-slate-500">
                  {fichier ? `P. ${currentPage} / ${pageCount}` : "Pages"}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
                  {loading ? (
                    <p className="text-xs text-slate-400 text-center py-4">Chargement…</p>
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
                              ? "bg-yellow-100 text-yellow-900 font-medium"
                              : "text-slate-600 hover:bg-white"
                          }`}
                        >
                          <span>P.{num}</span>
                          {zoneCount > 0 && (
                            <span className="ml-auto text-[10px] text-yellow-800">{zoneCount}z</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {fichier && !modeConsultation && !isValidationMode && (
              <div className="border-t border-slate-200 p-2 shrink-0 space-y-1.5">
                <WorkbenchUndoRedoButtons
                  canUndo={workbenchHistory.canUndo}
                  canRedo={workbenchHistory.canRedo}
                  onUndo={handleWorkbenchUndo}
                  onRedo={handleWorkbenchRedo}
                  disabled={manipulationDisabled || !fichier}
                  accent="yellow"
                />
                <div className="flex flex-wrap gap-1">
                  <SidebarToolButton
                    title="Changer le document"
                    disabled={manipulationDisabled}
                    onClick={() => replaceFileInputRef.current?.click()}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m-4 4V4" />
                    </svg>
                  </SidebarToolButton>
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
                </div>
              </div>
            )}

            {!isValidationMode && (
              <>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="hidden"
                  onChange={handleReplaceDocument}
                />
                <input
                  ref={addPagesInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  multiple
                  className="hidden"
                  onChange={handleAddPages}
                />
              </>
            )}
          </aside>

          <div className="flex-1 min-w-0 min-h-0 bg-slate-100 p-3 flex flex-col">
            {loading || !fichier ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                Chargement du document…
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
                  annotations={documentAnnotations}
                  annotationsReadOnly={documentAnnotations.length > 0}
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
                    accent: "yellow",
                  }}
                />
              </>
            )}
          </div>

          <aside
            ref={formPanelRef}
            className="w-96 xl:w-[28rem] 2xl:w-[32rem] shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0"
          >
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Index — vérification</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Corrigez les valeurs si nécessaire.</p>
                </div>
                <div className="flex flex-col items-stretch gap-1 shrink-0">
                  {canExtract && (
                    <button
                      type="button"
                      onClick={runOcrExtraction}
                      disabled={manipulationDisabled}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Extraire
                    </button>
                  )}
                  {hasConfigurableZones && !loading && (
                    <button
                      type="button"
                      onClick={handleToggleZones}
                      disabled={manipulationDisabled}
                      className={`inline-flex items-center justify-center px-3 py-1 text-[11px] font-medium rounded-lg border transition disabled:opacity-40 ${
                        showZonesMode
                          ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                          : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {showZonesMode ? "Masquer zones" : "Voir zones"}
                    </button>
                  )}
                </div>
              </div>
              {!ocrLoading && ocrFilledCount > 0 && (
                <p className="text-xs text-yellow-600 mt-2">
                  {ocrFilledCount} champ{ocrFilledCount > 1 ? "s" : ""} détecté{ocrFilledCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {loading ? (
                <p className="text-sm text-slate-400 text-center py-8">Chargement des champs…</p>
              ) : ocrLoading ? (
                <DocumentAnalysisLoading
                  columnCount={formPanelWidth >= 680 ? 2 : 1}
                  fileName={fichier?.name}
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
          </aside>
        </div>

        <div className="flex justify-between gap-3 shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
          {modeControle && qc.canRejeter ? (
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={busy || submitting}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition disabled:opacity-50"
            >
              Rejeter
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              {modeConsultation ? "Fermer" : "Annuler"}
            </button>
            {!modeConsultation && (
              <>
                {modeCorrection && qc.canChange && (
                  <button
                    type="button"
                    onClick={handleEnregistrer}
                    disabled={busy || submitting}
                    className="px-4 py-2 border border-yellow-400 text-yellow-800 bg-yellow-50 rounded-lg text-sm hover:bg-yellow-100 transition disabled:opacity-50"
                  >
                    {submitting ? "Enregistrement…" : "Enregistrer"}
                  </button>
                )}
                {modeControle && qc.canValider && (
                  <>
                    <button
                      type="submit"
                      disabled={busy || submitting}
                      className="px-5 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                    >
                      {submitting ? "Enregistrement…" : processing ? "Traitement…" : "Valider le document"}
                    </button>
                    <button
                      type="button"
                      onClick={handleValidateAndNext}
                      disabled={busy || submitting}
                      className="px-5 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                    >
                      {submitting ? "Enregistrement…" : processing ? "Traitement…" : "Valider et document suivant"}
                    </button>
                  </>
                )}
                {modeCorrection && qc.canSoumettre && (
                  <>
                    <button
                      type="button"
                      onClick={handleSoumettre}
                      disabled={busy || submitting}
                      className="px-5 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                    >
                      {submitting ? "Enregistrement…" : processing ? "Traitement…" : "Soumettre à validation"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSoumettreAndNext}
                      disabled={busy || submitting}
                      className="px-5 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                    >
                      {submitting ? "Enregistrement…" : processing ? "Traitement…" : "Soumettre et document suivant"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
