// Rendu PDF via react-pdf (pages, zoom, défilement)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "@/utils/configurePdfJs";
import PdfPageControls from "./PdfPageControls";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const BASE_WIDTH = 720;

function usePdfWheelScroll(scrollRef, deps = []) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      const maxTop = el.scrollHeight - el.clientHeight;
      const maxLeft = el.scrollWidth - el.clientWidth;
      if (maxTop <= 0 && maxLeft <= 0) return;

      const nextTop = el.scrollTop + e.deltaY;
      const nextLeft = el.scrollLeft + e.deltaX;
      const canScrollY =
        (e.deltaY > 0 && el.scrollTop < maxTop - 1) || (e.deltaY < 0 && el.scrollTop > 0);
      const canScrollX =
        (e.deltaX > 0 && el.scrollLeft < maxLeft - 1) || (e.deltaX < 0 && el.scrollLeft > 0);

      if (!canScrollY && !canScrollX) return;

      if (canScrollY) el.scrollTop = Math.max(0, Math.min(maxTop, nextTop));
      if (canScrollX) el.scrollLeft = Math.max(0, Math.min(maxLeft, nextLeft));

      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function PdfViewer({
  fileUrl,
  zoom = 1,
  continuousScroll = false,
  hideControls = false,
  scrollable = false,
  pageNumber: controlledPage,
  onPageChange,
  onNumPagesChange,
  onPageLoadSuccess,
  pageOverlay,
}) {
  const scrollRef = useRef(null);
  const [internalPage, setInternalPage] = useState(1);
  const [numPages, setNumPages] = useState(null);

  const pageNumber = controlledPage ?? internalPage;
  const safePageNumber =
    numPages != null && pageNumber > numPages
      ? numPages
      : Math.max(1, pageNumber ?? 1);

  const setPageNumber = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(pageNumber) : next;
      if (onPageChange) onPageChange(value);
      else setInternalPage(value);
    },
    [onPageChange, pageNumber]
  );

  useEffect(() => {
    if (numPages != null && controlledPage != null && controlledPage > numPages) {
      onPageChange?.(numPages);
    }
  }, [numPages, controlledPage, onPageChange]);

  useEffect(() => {
    setInternalPage(1);
    setNumPages(null);
    onNumPagesChange?.(null);
  }, [fileUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageWidth = Math.round(BASE_WIDTH * zoom);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [safePageNumber, pageWidth, fileUrl]);

  usePdfWheelScroll(scrollRef, [scrollable, safePageNumber, pageWidth, fileUrl, numPages]);

  const onDocumentLoadSuccess = ({ numPages: total }) => {
    setNumPages(total);
    onNumPagesChange?.(total);
    if (controlledPage != null) {
      if (controlledPage > total) onPageChange?.(total);
    } else {
      setPageNumber(1);
    }
  };

  const onItemClick = useCallback(
    ({ pageNumber: pn, pageIndex }) => {
      const target = pn ?? (pageIndex != null ? pageIndex + 1 : null);
      if (target && target >= 1) setPageNumber(target);
    },
    [setPageNumber]
  );

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages || p, p + 1));

  const loading = (
    <div className="flex items-center justify-center py-16 text-sm text-gray-500">
      Chargement du PDF…
    </div>
  );

  const error = (
    <div className="py-12 px-4 text-center text-sm text-red-600">
      Impossible d&apos;afficher ce PDF.
    </div>
  );

  const pageElement =
    numPages != null && safePageNumber >= 1 && safePageNumber <= numPages ? (
      <div className="relative inline-block">
        <Page
          key={`${safePageNumber}-${pageWidth}`}
          pageNumber={safePageNumber}
          width={pageWidth}
          renderTextLayer
          renderAnnotationLayer
          onLoadSuccess={onPageLoadSuccess}
        />
        {pageOverlay}
      </div>
    ) : null;

  if (scrollable) {
    return (
      <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
        <div ref={scrollRef} className="ged-pdf-scroll-area">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onItemClick={onItemClick}
            loading={loading}
            error={error}
          >
            <div className="inline-block align-top p-1">{pageElement}</div>
          </Document>
        </div>
      </div>
    );
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={onDocumentLoadSuccess}
      onItemClick={onItemClick}
      loading={loading}
      className="w-full"
      error={error}
    >
      {continuousScroll && numPages ? (
        <div className="flex flex-col items-center gap-4 py-1">
          {Array.from({ length: numPages }, (_, index) => {
            const page = index + 1;
            return (
              <div
                key={`page_${page}`}
                className="relative bg-white shadow-sm rounded border border-gray-200 overflow-hidden"
              >
                {numPages > 1 && (
                  <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-slate-800/75 text-white text-[10px] font-medium tabular-nums">
                    {page} / {numPages}
                  </span>
                )}
                <Page
                  pageNumber={page}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="inline-block w-max max-w-none align-top">
          {!hideControls && numPages != null && (
            <div className="mb-2">
              <PdfPageControls
                pageNumber={pageNumber}
                numPages={numPages}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
          )}
          {pageElement}
        </div>
      )}
    </Document>
  );
}
