// Vue scindée tableau / panneau d'aperçu document (redimensionnable)
"use client";

import { useEffect, useRef } from "react";
import DocumentPreview from "./DocumentPreview";
import DocumentPreviewVersionSelect from "./DocumentPreviewVersionSelect";
import ResizableSplitPane from "./ResizableSplitPane";
import { useDocumentPreviewVersions } from "../../../hooks/useDocumentPreviewVersions";
import { downloadDocumentLocalite } from "../../../services/documentLocalite.service";
import { hasPermission, PERMISSIONS } from "../../../utils/permissions";

export default function DocumentListSplitView({
  previewDoc,
  onClosePreview,
  onDownload,
  getFilename,
  listScrollRef = null,
  children,
}) {
  const previewPaneRef = useRef(null);
  const {
    loading: versionsLoading,
    selectedKey,
    setSelectedKey,
    versionOptions,
    previewSource,
    showVersionSelect,
  } = useDocumentPreviewVersions(previewDoc);

  // La zone sous le curseur (page Word, feuille Excel, PDF…) défile en priorité ;
  // la liste ne prend le relais que si cette zone est déjà en butée dans ce sens.
  useEffect(() => {
    if (!previewDoc) return undefined;
    const pane = previewPaneRef.current;
    if (!pane) return undefined;

    const canScrollInside = (el, dx, dy) => {
      const style = getComputedStyle(el);
      if (dy && /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        const room = dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        if (room) return true;
      }
      if (dx && /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        const room = dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
        if (room) return true;
      }
      return false;
    };

    const onWheel = (e) => {
      for (let el = e.target; el && el !== pane; el = el.parentElement) {
        if (el instanceof Element && canScrollInside(el, e.deltaX, e.deltaY)) return;
      }

      const listEl = listScrollRef?.current;
      if (listEl) {
        const maxTop = Math.max(0, listEl.scrollHeight - listEl.clientHeight);
        const maxLeft = Math.max(0, listEl.scrollWidth - listEl.clientWidth);
        let moved = false;

        if (maxTop > 0 && e.deltaY !== 0) {
          const next = Math.max(0, Math.min(maxTop, listEl.scrollTop + e.deltaY));
          if (next !== listEl.scrollTop) {
            listEl.scrollTop = next;
            moved = true;
          }
        }
        if (maxLeft > 0 && e.deltaX !== 0) {
          const next = Math.max(0, Math.min(maxLeft, listEl.scrollLeft + e.deltaX));
          if (next !== listEl.scrollLeft) {
            listEl.scrollLeft = next;
            moved = true;
          }
        }
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      const root = document.scrollingElement || document.documentElement;
      if (root && e.deltaY !== 0) {
        root.scrollTop += e.deltaY;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    pane.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => pane.removeEventListener("wheel", onWheel, { capture: true });
  }, [previewDoc, listScrollRef]);

  if (!previewDoc) {
    return <div className="flex-1 min-h-0 min-w-0 flex flex-col">{children}</div>;
  }

  const filename = getFilename(previewDoc);
  const canDownload = hasPermission(PERMISSIONS.TELECHARGER_DOCUMENT);

  const handleDownload = () => {
    if (!canDownload) return;
    if (onDownload) {
      onDownload(previewDoc, previewSource);
      return;
    }
    if (previewSource?.downloadMode === "archived" && previewSource.archivedVersionId) {
      downloadDocumentLocalite(previewDoc, filename, {
        versionId: previewSource.archivedVersionId,
      });
      return;
    }
    downloadDocumentLocalite(previewDoc, filename);
  };

  const previewPane = (
    <aside
      ref={previewPaneRef}
      className="flex flex-col h-full min-h-0 self-stretch bg-slate-50 overflow-hidden rounded-xl border border-slate-200 shadow-sm"
      aria-label="Aperçu du document"
    >
      <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <DocumentPreview
          key={`${previewDoc.id}-${selectedKey}-${previewSource?.previewUrl || ""}`}
          previewUrl={previewSource?.previewUrl}
          previewFileName={filename}
          large
          zoomable
          alwaysPan={false}
          dragPan={false}
          annotations={previewSource?.annotations}
          annotationsReadOnly={Boolean(previewSource?.annotations?.length)}
          versionSelect={
            showVersionSelect ? (
              <DocumentPreviewVersionSelect
                value={selectedKey}
                options={versionOptions}
                loading={versionsLoading}
                onChange={setSelectedKey}
              />
            ) : null
          }
          onDownload={canDownload ? handleDownload : undefined}
          onClose={onClosePreview}
        />
      </div>
    </aside>
  );

  return (
    <div className="flex-1 min-h-[28rem] h-[calc(100*var(--app-vh)-20rem)] min-w-0 flex flex-col overflow-hidden">
      <ResizableSplitPane
        defaultLeftPercent={50}
        left={
          <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            {children}
          </div>
        }
        right={previewPane}
      />
    </div>
  );
}
