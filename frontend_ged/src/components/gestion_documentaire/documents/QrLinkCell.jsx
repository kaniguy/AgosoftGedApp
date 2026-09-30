"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeHttpUrl } from "../../../utils/qrLink";
import { appViewportSize, cssZoomOf } from "../../../utils/appZoom";

const OPEN_DELAY_MS = 2000;
const CLOSE_DELAY_MS = 220;
const PREVIEW_WIDTH = 360;
const PREVIEW_HEIGHT = 260;

function computePreviewPosition(screenRect) {
  const gap = 8;
  const zoom = cssZoomOf(document.body);
  const { width: vw, height: vh } = appViewportSize();
  const anchorRect = {
    left: screenRect.left / zoom,
    top: screenRect.top / zoom,
    bottom: screenRect.bottom / zoom,
  };

  let left = anchorRect.left;
  if (left + PREVIEW_WIDTH > vw - 12) left = Math.max(12, vw - PREVIEW_WIDTH - 12);
  if (left < 12) left = 12;

  const below = anchorRect.bottom + gap;
  const above = anchorRect.top - PREVIEW_HEIGHT - gap;
  const top =
    below + PREVIEW_HEIGHT <= vh - 12
      ? below
      : above >= 12
        ? above
        : Math.max(12, Math.min(below, vh - PREVIEW_HEIGHT - 12));

  return { top, left };
}

/**
 * Affiche une valeur qui est une URL : lien cliquable + aperçu iframe au survol (chargement différé).
 * Si ce n’est pas une URL, affiche le texte tel quel.
 */
export default function QrLinkCell({ value, className = "" }) {
  const raw = value == null ? "" : String(value).trim();
  const href = normalizeHttpUrl(raw);
  const panelId = useId();
  const anchorRef = useRef(null);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loadSrc, setLoadSrc] = useState(null);
  const [iframeState, setIframeState] = useState("idle");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLoadSrc(null);
    setIframeState("idle");
    setOpen(false);
  }, [href]);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setPos(computePreviewPosition(el.getBoundingClientRect()));
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => {
      updatePosition();
      setOpen(true);
      setLoadSrc((prev) => prev || href);
      setIframeState((prev) => (prev === "ready" ? "ready" : "loading"));
    }, OPEN_DELAY_MS);
  }, [clearTimers, href, updatePosition]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!open) return undefined;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || iframeState !== "loading") return undefined;
    const t = setTimeout(() => setIframeState("ready"), 4500);
    return () => clearTimeout(t);
  }, [open, iframeState]);

  if (!raw) {
    return <span className={className}>—</span>;
  }

  if (!href) {
    return (
      <span className={`break-words text-gray-800 text-xs ${className}`} title={raw}>
        {raw}
      </span>
    );
  }

  const preview = open && mounted
    ? createPortal(
        <div
          id={panelId}
          role="tooltip"
          className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: PREVIEW_WIDTH }}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <p className="text-[11px] text-slate-600 truncate min-w-0" title={href}>
              {href}
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ouvrir
            </a>
          </div>
          <div className="relative bg-slate-100" style={{ height: PREVIEW_HEIGHT }}>
            {iframeState === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs z-10 bg-slate-100/90 pointer-events-none">
                <span className="inline-block w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                Chargement de la page…
              </div>
            )}
            {loadSrc && (
              <iframe
                title={`Aperçu ${href}`}
                src={loadSrc}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                loading="lazy"
                onLoad={() => setIframeState("ready")}
                onError={() => setIframeState("ready")}
              />
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block max-w-full truncate text-teal-700 font-medium text-xs underline-offset-2 hover:underline hover:text-teal-900 ${className}`}
        title={href}
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>
      {preview}
    </>
  );
}
