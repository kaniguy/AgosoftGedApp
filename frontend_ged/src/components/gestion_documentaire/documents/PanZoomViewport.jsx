// Zone d'aperçu avec défilement et glisser-déposer (pan / zoom)
"use client";

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const DRAG_THRESHOLD = 5;

// Zone de prévisualisation : défilement vertical/horizontal + glisser pour déplacer
const PanZoomViewport = forwardRef(function PanZoomViewport({
  children,
  className = "",
  active = true,
  forcePan = false,
  dragPan = true,
  disablePan = false,
  contentVersion,
}, ref) {
  const viewportRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [canPan, setCanPan] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const pointerIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    resetScroll: () => {
      const el = viewportRef.current;
      if (el) {
        el.scrollLeft = 0;
        el.scrollTop = 0;
      }
    },
  }));

  const refreshOverflow = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const inner = el.firstElementChild;
    const contentW = inner?.scrollWidth ?? el.scrollWidth;
    const contentH = inner?.scrollHeight ?? el.scrollHeight;
    setCanPan(contentW > el.clientWidth + 4 || contentH > el.clientHeight + 4);
  }, []);

  useEffect(() => {
    refreshOverflow();
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxTop <= 0 && maxLeft <= 0) return;

      let scrolled = false;

      if (maxTop > 0 && e.deltaY !== 0) {
        const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + e.deltaY));
        if (nextTop !== el.scrollTop) {
          el.scrollTop = nextTop;
          scrolled = true;
        }
      }

      if (maxLeft > 0 && e.deltaX !== 0) {
        const nextLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + e.deltaX));
        if (nextLeft !== el.scrollLeft) {
          el.scrollLeft = nextLeft;
          scrolled = true;
        }
      }

      if (scrolled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });

    const observer = new ResizeObserver(() => refreshOverflow());
    observer.observe(el);
    const inner = el.firstElementChild;
    if (inner) observer.observe(inner);

    const onMediaLoad = () => refreshOverflow();
    const imgs = el.querySelectorAll("img, canvas");
    imgs.forEach((node) => {
      if (node instanceof HTMLImageElement) {
        if (node.complete) onMediaLoad();
        else node.addEventListener("load", onMediaLoad);
      } else {
        onMediaLoad();
      }
    });

    const raf = requestAnimationFrame(() => refreshOverflow());
    const t1 = setTimeout(refreshOverflow, 150);
    const t2 = setTimeout(refreshOverflow, 600);

    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      imgs.forEach((node) => {
        if (node instanceof HTMLImageElement) {
          node.removeEventListener("load", onMediaLoad);
        }
      });
    };
  }, [children, contentVersion, refreshOverflow]);

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "a, button, input, select, textarea, .react-pdf__Page__textContent, .textLayer, .react-pdf__Page__annotations, .annotationLayer, .capture-zone-adjust, .react-draggable, .react-resizable-handle"
      )
    );
  };

  const stopDragging = useCallback(() => {
    if (pointerIdRef.current != null) {
      viewportRef.current?.releasePointerCapture(pointerIdRef.current);
      pointerIdRef.current = null;
    }
    setDragging(false);
  }, []);

  const handlePointerDown = (e) => {
    if (!active || !dragPan || e.button !== 0) return;
    if (disablePan) return;
    if (!canPan && !forcePan) return;
    if (isInteractiveTarget(e.target)) return;

    const el = viewportRef.current;
    if (!el) return;

    dragOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    pointerIdRef.current = e.pointerId;
  };

  const handlePointerMove = (e) => {
    if (pointerIdRef.current == null || e.pointerId !== pointerIdRef.current) return;

    const el = viewportRef.current;
    if (!el) return;

    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;

    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      setDragging(true);
      el.setPointerCapture(e.pointerId);
    }

    e.preventDefault();
    el.scrollLeft = dragOrigin.current.scrollLeft - dx;
    el.scrollTop = dragOrigin.current.scrollTop - dy;
  };

  const handlePointerUp = (e) => {
    if (pointerIdRef.current !== e.pointerId) return;
    stopDragging();
  };

  const panEnabled = active && dragPan && !disablePan && (forcePan || canPan);
  const cursorClass = panEnabled
    ? dragging
      ? "cursor-grabbing"
      : "cursor-grab"
    : "cursor-default";

  return (
    <div
      ref={viewportRef}
      className={`ged-doc-scroll ged-doc-scroll-inner flex-1 min-h-0 h-full max-h-full w-full overflow-x-auto overflow-y-auto overscroll-contain touch-pan-x touch-pan-y ${cursorClass} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="region"
      aria-label="Zone de prévisualisation du document"
    >
      <div className="inline-block w-max max-w-none align-top">{children}</div>
    </div>
  );
});

export default PanZoomViewport;
