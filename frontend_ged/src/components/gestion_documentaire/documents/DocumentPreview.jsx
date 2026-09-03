// Aperçu document (PDF ou image) : chargement, zoom, pagination, surlignage des zones de capture
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDocumentFileBlob } from "../../../services/documentLocalite.service";
import { CAPTURE_BASE_PAGE_WIDTH, champHasCaptureZone } from "@/utils/captureZoneUtils";
import CaptureZonesOverlay from "./CaptureZonesOverlay";
import CaptureZonesAdjustOverlay from "./CaptureZonesAdjustOverlay";
import CaptureZonePageControls from "./CaptureZonePageControls";
import PanZoomViewport from "./PanZoomViewport";
import PdfPageControls from "./PdfPageControls";
import PdfAnnotationsLayer from "./PdfAnnotationsLayer";
import AnnotationToolbar from "./AnnotationToolbar";
import SignatureCreateModal from "./SignatureCreateModal";
import DocumentOcrScanOverlay from "./DocumentOcrScanOverlay";
import { ANNOTATION_COLORS, ANNOTATION_TOOLS } from "@/utils/pdfAnnotationUtils";
import { getProfile, updateUserSignature } from "../../../services/profile.service";
import { apiFetch, resolveMediaUrl } from "../../../services/api";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const BASE_IMAGE_WIDTH = CAPTURE_BASE_PAGE_WIDTH;

function isImageFile(file) {
  if (file?.type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file?.name || "");
}

function isPdfFile(file) {
  return file?.type === "application/pdf" || (file?.name || "").toLowerCase().endsWith(".pdf");
}

function detectPreviewKind({ file, previewUrl, previewFileName, blobType }) {
  if (file) {
    if (isPdfFile(file)) return "pdf";
    if (isImageFile(file)) return "image";
  }

  if (blobType === "application/pdf") return "pdf";
  if (blobType?.startsWith("image/")) return "image";

  const source = `${previewFileName || ""} ${previewUrl || ""}`.toLowerCase();
  if (source.includes(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif)(\?|$)/.test(source)) return "image";
  return null;
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await apiFetch(url);
    if (res.ok) return blobToDataUrl(await res.blob());
  } catch {
    // ignore
  }
  return null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function readStoredUsername() {
  if (typeof window === "undefined") return "";
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.username || user.first_name || "";
  } catch {
    return "";
  }
}

function ZoomToolbar({ zoom, onZoomIn, onZoomOut, onReset }) {
  return (
    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-lg leading-none"
        title="Zoom arrière"
      >
        −
      </button>
      <span className="text-xs text-gray-500 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-lg leading-none"
        title="Zoom avant"
      >
        +
      </button>
      <button
        type="button"
        onClick={onReset}
        className="px-2 h-8 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        title="Réinitialiser le zoom"
      >
        Ajuster
      </button>
      {/* <span className="text-[10px] text-gray-400 ml-1 hidden lg:inline">Trackpad, molette ou glisser</span> */}
    </div>
  );
}

// Bouton d'import intégré dans la zone d'aperçu
function ImportFileControl({
  fileInputRef,
  accept,
  disabled,
  disabledHint,
  onFileChange,
  variant = "empty",
  fileName,
}) {
  const localRef = useRef(null);
  const inputRef = fileInputRef || localRef;

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6">
        <svg className="w-14 h-14 mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-gray-500 mb-4">Importez un PDF ou une image pour prévisualiser</p>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Choisir un document
        </button>
        {disabled && disabledHint && (
          <p className="text-xs text-amber-600 mt-3 max-w-xs">{disabledHint}</p>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={onFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {fileName && (
        <span className="text-xs text-gray-500 truncate max-w-[180px]" title={fileName}>
          {fileName}
        </span>
      )}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Changer
      </button>
      <input ref={inputRef} type="file" accept={accept} onChange={onFileChange} className="hidden" />
    </div>
  );
}

export default function DocumentPreview({
  file,
  previewUrl,
  previewFileName,
  large = false,
  zoomable = false,
  alwaysPan = false,
  dragPan = true,
  continuousScroll = false,
  fileInputRef,
  acceptFiles,
  importEnabled = false,
  importDisabledHint,
  onFileChange,
  onDownload,
  onClose,
  captureChamps = [],
  filledChampIds = [],
  activeChampId = null,
  focusPageIndex = null,
  pageNumber: externalPageNumber = null,
  onPageChange: externalOnPageChange = null,
  showCaptureZones = true,
  zoneAdjustMode = false,
  onZoneChange,
  onActiveChampChange,
  ocrLoading = false,
  ocrProgress = 0,
  onOcrCancel,
  zonePageControls = null,
  annotationMode = false,
  annotations = [],
  onAnnotationsChange,
  annotationTool = ANNOTATION_TOOLS.SELECT,
  onAnnotationToolChange,
  annotationColor = ANNOTATION_COLORS.yellow,
  onAnnotationColorChange,
  stampKey = "approuve",
  onStampKeyChange,
  stampImageData = null,
  stampText = null,
  stampColor = null,
  onRequestStamp,
  onAnnotationUndo,
  onAnnotationRedo,
  onAnnotationClearPage,
  onAnnotationDeleteSelected,
  canAnnotationUndo = false,
  canAnnotationRedo = false,
  canAnnotationDeleteSelected = false,
  selectedAnnotationId = null,
  onSelectAnnotation,
  onAnnotationsHistoryCommit,
  annotationsReadOnly = false,
  versionSelect,
  hideAnnotationToolbar = false,
  signatureImageData: signatureImageDataProp = undefined,
  onRequestSignature: onRequestSignatureProp = undefined,
}) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [blobType, setBlobType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [internalPdfPage, setInternalPdfPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState(null);
  const [pageHeight, setPageHeight] = useState(0);
  const panZoomRef = useRef(null);
  const [signatureImageDataInternal, setSignatureImageDataInternal] = useState(null);
  const [signatureUsername, setSignatureUsername] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);

  const signatureControlled = signatureImageDataProp !== undefined;
  const signatureImageData = signatureControlled
    ? signatureImageDataProp
    : signatureImageDataInternal;
  const openSignatureModalExternal = onRequestSignatureProp;

  const isPageControlled =
    externalPageNumber != null && typeof externalOnPageChange === "function";
  const pdfPage = isPageControlled ? externalPageNumber : internalPdfPage;

  const updatePdfPage = useCallback(
    (nextPage) => {
      if (isPageControlled) {
        externalOnPageChange(nextPage);
      } else {
        setInternalPdfPage(nextPage);
      }
    },
    [isPageControlled, externalOnPageChange]
  );

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setBlobType(file.type || null);
      setLoadError(null);
      setLoading(false);
      return () => URL.revokeObjectURL(url);
    }

    if (!previewUrl) {
      setObjectUrl(null);
      setBlobType(null);
      setLoadError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let blobUrl = null;

    const loadRemotePreview = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { blob, blobUrl: nextUrl } = await fetchDocumentFileBlob(previewUrl);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        blobUrl = nextUrl;
        setObjectUrl(nextUrl);
        setBlobType(blob.type || null);
      } catch (err) {
        if (!cancelled) {
          setObjectUrl(null);
          setBlobType(null);
          setLoadError(err.message || "Impossible de charger l'aperçu");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRemotePreview();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file, previewUrl]);

  useEffect(() => {
    if (!annotationMode || signatureControlled || hideAnnotationToolbar) return undefined;
    let cancelled = false;

    const loadUserSignature = async () => {
      setSignatureUsername(readStoredUsername());
      try {
        const profile = await getProfile();
        if (cancelled) return;
        setSignatureUsername(profile.username || readStoredUsername());
        if (profile.signature) {
          const dataUrl = await fetchImageAsDataUrl(resolveMediaUrl(profile.signature));
          if (!cancelled && dataUrl) setSignatureImageDataInternal(dataUrl);
        }
      } catch {
        // profil indisponible — la modal permettra de créer la signature
      }
    };

    loadUserSignature();
    return () => {
      cancelled = true;
    };
  }, [annotationMode, signatureControlled, hideAnnotationToolbar]);

  const openSignatureModal = useCallback(() => {
    if (openSignatureModalExternal) {
      openSignatureModalExternal();
      return;
    }
    setShowSignatureModal(true);
  }, [openSignatureModalExternal]);

  const handleAnnotationToolChange = useCallback(
    (toolId) => {
      onAnnotationToolChange?.(toolId);
    },
    [onAnnotationToolChange]
  );

  const handleSignatureCreated = useCallback(
    async ({ dataUrl, file: signatureFile }) => {
      setSignatureSaving(true);
      try {
        await updateUserSignature(signatureFile);
        setSignatureImageDataInternal(dataUrl);
        setShowSignatureModal(false);
        onAnnotationToolChange?.(ANNOTATION_TOOLS.SIGNATURE);
      } catch (err) {
        window.alert(err.message || "Impossible d'enregistrer la signature sur le compte.");
      } finally {
        setSignatureSaving(false);
      }
    },
    [onAnnotationToolChange]
  );

  useEffect(() => {
    setZoom(1);
    if (!isPageControlled) {
      setInternalPdfPage(1);
    }
    setPdfNumPages(null);
    setPageHeight(0);
  }, [file, previewUrl, previewFileName, isPageControlled]);

  /** Synchronise la page PDF affichée quand l'utilisateur focus un champ d'une autre page. */
  useEffect(() => {
    if (focusPageIndex != null && focusPageIndex >= 0) {
      updatePdfPage(focusPageIndex + 1);
    }
  }, [focusPageIndex, updatePdfPage]);

  useEffect(() => {
    if (pdfNumPages != null && pdfPage > pdfNumPages) {
      updatePdfPage(pdfNumPages);
    }
  }, [pdfNumPages, pdfPage, updatePdfPage]);

  const zonesConfigured = useMemo(
    () => (captureChamps || []).filter(champHasCaptureZone).length,
    [captureChamps]
  );

  const zonesVisible = showCaptureZones && zonesConfigured > 0;

  const kind = useMemo(
    () => detectPreviewKind({ file, previewUrl, previewFileName, blobType }),
    [file, previewUrl, previewFileName, blobType]
  );

  const pdfPageWidth = Math.round(CAPTURE_BASE_PAGE_WIDTH * zoom);
  const imageWidth = pdfPageWidth;

  /**
   * Met à jour la hauteur de page PDF pour positionner l'overlay des zones.
   */
  const handlePdfPageLoadSuccess = (page) => {
    const viewport = page.getViewport({ scale: 1 });
    const scale = pdfPageWidth / viewport.width;
    setPageHeight(viewport.height * scale);
  };

  /**
   * Met à jour la hauteur de page image pour positionner l'overlay des zones.
   */
  const handleImageLoad = (e) => {
    const img = e.target;
    const scale = imageWidth / img.naturalWidth;
    setPageHeight(img.naturalHeight * scale);
  };

  const zonesLegend = zonesVisible && (
    <div className="flex items-center gap-2 text-[10px] text-gray-500 shrink-0 flex-wrap">
      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 border-2 border-dashed border-blue-500 bg-blue-500/20 rounded-sm" />
        Zone
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 border-2 border-emerald-600 bg-emerald-400/30 rounded-sm" />
        Détecté
      </span>
      {zoneAdjustMode && (
        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
          Glisser · clic = taille
        </span>
      )}
    </div>
  );

  const zonePageToolbar = zonePageControls?.visible ? (
    <CaptureZonePageControls
      variant="toolbar"
      pageCount={zonePageControls.pageCount ?? pdfNumPages ?? 1}
      currentPage={pdfPage}
      {...zonePageControls}
    />
  ) : null;

  const renderZonesOverlay = (pageIndex, width, height) => {
    if (!showCaptureZones || height <= 0) return null;
    if (zoneAdjustMode) {
      return (
        <CaptureZonesAdjustOverlay
          champs={captureChamps}
          pageIndex={pageIndex}
          pageWidth={width}
          pageHeight={height}
          filledChampIds={filledChampIds}
          activeChampId={activeChampId}
          onActiveChampChange={onActiveChampChange}
          onZoneChange={onZoneChange}
        />
      );
    }
    return (
      <CaptureZonesOverlay
        champs={captureChamps}
        pageIndex={pageIndex}
        pageWidth={width}
        pageHeight={height}
        filledChampIds={filledChampIds}
        activeChampId={activeChampId}
        showLabels={false}
        onActiveChampChange={onActiveChampChange}
      />
    );
  };

  const renderPageOverlay = (pageIndex, width, height) => (
    <>
      {renderZonesOverlay(pageIndex, width, height)}
      {(annotationMode && onAnnotationsChange) || (annotationsReadOnly && annotations?.length) ? (
        <PdfAnnotationsLayer
          pageIndex={pageIndex}
          pageWidth={width}
          pageHeight={height}
          annotations={annotations}
          onChange={onAnnotationsChange}
          onHistoryCommit={onAnnotationsHistoryCommit}
          activeTool={annotationTool}
          activeColor={annotationColor}
          stampKey={stampKey}
          stampImageData={stampImageData}
          stampText={stampText}
          stampColor={stampColor}
          onRequestStamp={onRequestStamp}
          signatureImageData={signatureImageData}
          onRequestSignature={openSignatureModal}
          selectedId={selectedAnnotationId}
          onSelect={onSelectAnnotation}
          readOnly={annotationsReadOnly}
        />
      ) : null}
    </>
  );

  const ocrProgressOverlay = ocrLoading ? (
    <DocumentOcrScanOverlay progress={ocrProgress} onCancel={onOcrCancel} />
  ) : null;

  const documentViewport = (content, scrollKey) => (
    <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
      {scrollViewport(content, scrollKey)}
      {ocrProgressOverlay}
    </div>
  );

  const displayFileName = file?.name || previewFileName || null;

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const resetZoom = () => {
    setZoom(1);
    panZoomRef.current?.resetScroll?.();
  };

  const shellClass = large
    ? "flex flex-col h-full w-full min-h-0 border border-slate-200 rounded-lg overflow-hidden bg-slate-100"
    : "flex flex-col h-full min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-100";

  const innerScrollViewport = (content, scrollKey) => (
    <div className="flex-1 min-h-0 h-0 overflow-hidden flex flex-col">
      <PanZoomViewport
        ref={panZoomRef}
        active={zoomable}
        dragPan={dragPan}
        disablePan={zoneAdjustMode || (annotationMode && annotationTool !== ANNOTATION_TOOLS.SELECT)}
        forcePan={zoomable && (zoom > 1 || alwaysPan) && !zoneAdjustMode}
        contentVersion={`${scrollKey}-${zoom}-${zoneAdjustMode}`}
        className="bg-white h-full max-h-full"
      >
        {content}
      </PanZoomViewport>
    </div>
  );

  const scrollViewport = (content, scrollKey = zoom) => innerScrollViewport(content, scrollKey);

  const importProps = {
    fileInputRef,
    accept: acceptFiles,
    disabled: !importEnabled,
    disabledHint: importDisabledHint,
    onFileChange,
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-full min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-100 ${large ? "" : "min-h-64"}`}>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          Chargement de l&apos;aperçu…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`flex flex-col h-full min-h-0 border border-red-200 rounded-lg overflow-hidden bg-red-50 ${large ? "" : "min-h-64"}`}>
        <div className="flex-1 flex items-center justify-center px-6 text-sm text-red-600 text-center">
          {loadError}
        </div>
      </div>
    );
  }

  if (!objectUrl || !kind) {
    return (
      <div
        className={`flex flex-col h-full min-h-0 border-2 border-dashed border-emerald-200 rounded-lg bg-gradient-to-b from-white to-emerald-50/30 ${
          large ? "" : "min-h-64"
        }`}
      >
        <div className="flex-1 flex items-center justify-center">
          {onFileChange ? (
            <ImportFileControl variant="empty" {...importProps} />
          ) : (
            <p className="text-sm text-gray-400">Aucun document</p>
          )}
        </div>
      </div>
    );
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {versionSelect}
      {onFileChange ? (
        <ImportFileControl variant="toolbar" fileName={file?.name} {...importProps} />
      ) : (
        displayFileName && (
          <span className="text-xs text-gray-500 truncate max-w-[180px]" title={displayFileName}>
            {displayFileName}
          </span>
        )
      )}
      {zoomable && <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />}
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs cursor-pointer"
          title="Télécharger"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
          title="Fermer l'aperçu"
          aria-label="Fermer l'aperçu"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  if (kind === "pdf") {
    const goPdfPrev = () => updatePdfPage(Math.max(1, pdfPage - 1));
    const goPdfNext = () => updatePdfPage(Math.min(pdfNumPages || pdfPage, pdfPage + 1));

    return (
      <div className={`${shellClass} relative`}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">Aperçu PDF</span>
            {zonesConfigured > 0 && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {zonesConfigured} zone{zonesConfigured > 1 ? "s" : ""} de capture
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0 justify-end">
            {zonesLegend}
            {zonePageToolbar}
            {toolbar}
          </div>
        </div>
        {annotationMode && onAnnotationToolChange && !hideAnnotationToolbar && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 shrink-0 space-y-1.5">
            <AnnotationToolbar
              activeTool={annotationTool}
              onToolChange={handleAnnotationToolChange}
              activeColor={annotationColor}
              onColorChange={onAnnotationColorChange}
              onUndo={onAnnotationUndo}
              onRedo={onAnnotationRedo}
              onClearPage={onAnnotationClearPage}
              onDeleteSelected={onAnnotationDeleteSelected}
              canUndo={canAnnotationUndo}
              canRedo={canAnnotationRedo}
              canDeleteSelected={canAnnotationDeleteSelected}
            />
            <p className="text-[11px] text-amber-900/70">
              Cliquez un élément pour le déplacer / redimensionner / pivoter. Bouton rouge × ou
              Suppr pour supprimer. <strong>Double-clic</strong> sur un texte pour le modifier.
            </p>
          </div>
        )}
        {pdfNumPages != null && (
          <div className="shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <PdfPageControls
              pageNumber={pdfPage}
              numPages={pdfNumPages}
              onPrev={goPdfPrev}
              onNext={goPdfNext}
            />
          </div>
        )}
        {documentViewport(
          <PdfViewer
            fileUrl={objectUrl}
            zoom={zoom}
            hideControls
            pageNumber={pdfPage}
            onPageChange={updatePdfPage}
            onNumPagesChange={setPdfNumPages}
            onPageLoadSuccess={handlePdfPageLoadSuccess}
            pageOverlay={renderPageOverlay(pdfPage - 1, pdfPageWidth, pageHeight)}
          />,
          `pdf-${pdfPage}-${zoom}`
        )}
        {!signatureControlled && (
          <SignatureCreateModal
            open={showSignatureModal}
            onClose={() => setShowSignatureModal(false)}
            onCreated={handleSignatureCreated}
            username={signatureUsername}
            busy={signatureSaving}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`${shellClass} relative`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Aperçu image</span>
          {zonesConfigured > 0 && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {zonesConfigured} zone{zonesConfigured > 1 ? "s" : ""} de capture
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {zonesLegend}
          {toolbar}
        </div>
      </div>
      {annotationMode && onAnnotationToolChange && !hideAnnotationToolbar && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 shrink-0 space-y-1.5">
          <AnnotationToolbar
            activeTool={annotationTool}
            onToolChange={handleAnnotationToolChange}
            activeColor={annotationColor}
            onColorChange={onAnnotationColorChange}
            onUndo={onAnnotationUndo}
            onRedo={onAnnotationRedo}
            onClearPage={onAnnotationClearPage}
            onDeleteSelected={onAnnotationDeleteSelected}
            canUndo={canAnnotationUndo}
            canRedo={canAnnotationRedo}
            canDeleteSelected={canAnnotationDeleteSelected}
          />
          <p className="text-[11px] text-amber-900/70">
            Cliquez un élément pour le déplacer / redimensionner / pivoter. Bouton rouge × ou
            Suppr pour supprimer. <strong>Double-clic</strong> sur un texte pour le modifier.
          </p>
        </div>
      )}
      {documentViewport(
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={objectUrl}
            alt="Aperçu document"
            className="block max-w-none select-none"
            style={{ width: `${imageWidth}px`, height: "auto" }}
            onLoad={handleImageLoad}
            draggable={false}
          />
          {renderPageOverlay(0, imageWidth, pageHeight)}
        </div>
      )}
      {!signatureControlled && (
        <SignatureCreateModal
          open={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onCreated={handleSignatureCreated}
          username={signatureUsername}
          busy={signatureSaving}
        />
      )}
    </div>
  );
}
