/**
 * Modal de rognage / recadrage d'une page PDF (avec pivot gauche/droite).
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import { pdfjs } from "@/utils/configurePdfJs";
import { appViewportSize, cssZoomOf } from "@/utils/appZoom";

const PORTRAIT_TARGET_WIDTH = 560;
const LANDSCAPE_MAX_WIDTH = 1180;
const PORTRAIT_MAX_WIDTH = 720;
const MODAL_CHROME_HEIGHT = 200;
const CONTENT_PADDING = 40;

function defaultCrop(canvasWidth, canvasHeight) {
  const margin = Math.round(Math.min(canvasWidth, canvasHeight) * 0.04);
  return {
    x: margin,
    y: margin,
    width: canvasWidth - margin * 2,
    height: canvasHeight - margin * 2,
  };
}

/**
 * Calcule l'échelle d'affichage pour remplir l'espace disponible (paysage = modal plus large).
 */
function computeDisplayScale(viewportWidth, viewportHeight) {
  const isLandscape = viewportWidth > viewportHeight;

  if (typeof window === "undefined") {
    const base = isLandscape ? 900 : PORTRAIT_TARGET_WIDTH;
    return base / viewportWidth;
  }

  const { width: windowWidth, height: windowHeight } = appViewportSize();
  const maxModalWidth = isLandscape
    ? Math.min(windowWidth - 32, LANDSCAPE_MAX_WIDTH)
    : Math.min(windowWidth - 32, PORTRAIT_MAX_WIDTH);
  const maxContentHeight = windowHeight * 0.92 - MODAL_CHROME_HEIGHT;

  const scaleByWidth = (maxModalWidth - CONTENT_PADDING) / viewportWidth;
  const scaleByHeight = maxContentHeight / viewportHeight;

  if (isLandscape) {
    return Math.min(scaleByWidth, scaleByHeight, 2.5);
  }

  const portraitScale = PORTRAIT_TARGET_WIDTH / viewportWidth;
  return Math.min(portraitScale, scaleByHeight, 2);
}

export default function PageCropModal({ file, pageIndex, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageUrl, setPageUrl] = useState(null);
  const [displayWidth, setDisplayWidth] = useState(PORTRAIT_TARGET_WIDTH);
  const [displayHeight, setDisplayHeight] = useState(400);
  const [crop, setCrop] = useState({ x: 28, y: 28, width: 504, height: 344 });
  const [rotation, setRotation] = useState(0);

  const isLandscape = displayWidth > displayHeight;

  const renderPage = useCallback(async (rotationDegrees) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1, rotation: rotationDegrees });
    const scale = computeDisplayScale(viewport.width, viewport.height);
    const renderViewport = page.getViewport({ scale, rotation: rotationDegrees });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rendu impossible"))), "image/png");
    });

    return {
      objectUrl: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      landscape: canvas.width > canvas.height,
    };
  }, [file, pageIndex]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const rendered = await renderPage(rotation);
        objectUrl = rendered.objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setDisplayWidth(rendered.width);
        setDisplayHeight(rendered.height);
        setPageUrl(rendered.objectUrl);
        setCrop(defaultCrop(rendered.width, rendered.height));
      } catch (err) {
        if (!cancelled) setError(err.message || "Impossible de charger la page");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [renderPage, rotation]);

  const normalizedCrop = useMemo(() => {
    if (!displayHeight || displayWidth <= 0) return null;
    return {
      x: crop.x / displayWidth,
      y: crop.y / displayHeight,
      width: crop.width / displayWidth,
      height: crop.height / displayHeight,
    };
  }, [crop, displayHeight, displayWidth]);

  const handleRotateLeft = () => setRotation((r) => (r + 270) % 360);
  const handleRotateRight = () => setRotation((r) => (r + 90) % 360);

  const handleApply = () => {
    if (!normalizedCrop) return;
    onConfirm({ cropRect: normalizedCrop, rotationDegrees: rotation });
  };

  const modalWidthClass = isLandscape
    ? "max-w-[min(96*var(--app-vw),75rem)]"
    : "max-w-3xl";

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/50">
      <div
        className={`bg-white rounded-xl shadow-xl ${modalWidthClass} w-full border border-yellow-200 max-h-[calc(96*var(--app-vh))] flex flex-col`}
      >
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">Rogner / Recadrer — page {pageIndex + 1}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pivotez si besoin, ajustez le cadre, puis appliquez.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 p-1 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition"
            aria-label="Fermer"
            title="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`flex-1 min-h-0 overflow-auto ${isLandscape ? "p-3" : "p-5"}`}>
          {loading && <p className="text-sm text-slate-400 text-center py-12">Chargement de la page…</p>}
          {error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}

          {!loading && !error && pageUrl && (
            <div className="flex justify-center">
              <div
                className="relative border border-slate-200 bg-white shadow-inner select-none max-w-full"
                style={{ width: displayWidth, height: displayHeight }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageUrl}
                  alt={`Page ${pageIndex + 1}`}
                  className="block w-full h-full pointer-events-none"
                  draggable={false}
                />
                <div className="absolute inset-0">
                  <Rnd
                    size={{ width: crop.width, height: crop.height }}
                    position={{ x: crop.x, y: crop.y }}
                    bounds="parent"
                    scale={cssZoomOf()}
                    minWidth={40}
                    minHeight={40}
                    onDragStop={(_e, data) => setCrop((prev) => ({ ...prev, x: data.x, y: data.y }))}
                    onResizeStop={(_e, _dir, ref, _delta, position) =>
                      setCrop({
                        x: position.x,
                        y: position.y,
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                      })
                    }
                    className="border-2 border-yellow-500 bg-yellow-400/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  >
                    <div className="absolute -top-6 left-0 text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                      Zone conservée
                    </div>
                  </Rnd>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRotateLeft}
              disabled={loading || !!error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18M3 10h10a8 8 0 018 8v2" />
              </svg>
              Pivoter à gauche
            </button>
            <button
              type="button"
              onClick={handleRotateRight}
              disabled={loading || !!error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3m10-4v10a8 8 0 01-8 8h-2" />
              </svg>
              Pivoter à droite
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !!error}
              className="px-4 py-1.5 text-sm text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg disabled:opacity-50"
            >
              Appliquer le rognage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
