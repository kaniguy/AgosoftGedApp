/**
 * Trois panneaux côte à côte avec poignées de redimensionnement.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_LEFT = 14;
const MIN_CENTER = 16;
const MIN_RIGHT = 22;
const HANDLE_W = 8;

export default function ResizableThreePane({
  left,
  center,
  right,
  defaultLeftPercent = 22,
  defaultCenterPercent = 28,
  accent = "cyan",
}) {
  const containerRef = useRef(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [centerPercent, setCenterPercent] = useState(defaultCenterPercent);
  const [dragging, setDragging] = useState(null);

  const handleColor =
    accent === "cyan"
      ? "bg-slate-100 hover:bg-cyan-100 border-slate-200 group-hover:bg-cyan-50"
      : "bg-gray-100 hover:bg-slate-200 border-gray-200";

  const barColor = accent === "cyan" ? "bg-slate-300 group-hover:bg-cyan-500" : "bg-gray-300";

  const updateFromClientX = useCallback(
    (clientX, handle) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = ((clientX - rect.left) / rect.width) * 100;

      if (handle === "left") {
        const maxLeft = 100 - MIN_CENTER - MIN_RIGHT - 2;
        setLeftPercent(Math.min(maxLeft, Math.max(MIN_LEFT, ratio)));
      } else if (handle === "center") {
        const minCenter = leftPercent + MIN_CENTER;
        const maxCenter = 100 - MIN_RIGHT;
        const centerEnd = Math.min(maxCenter, Math.max(minCenter, ratio));
        setCenterPercent(centerEnd - leftPercent);
      }
    },
    [leftPercent]
  );

  const handlePointerDown = (handle) => (e) => {
    e.preventDefault();
    setDragging(handle);
  };

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => updateFromClientX(e.clientX, dragging);
    const onUp = () => setDragging(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, updateFromClientX]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 w-full items-stretch ${dragging ? "select-none" : ""}`}
    >
      <div
        className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden"
        style={{ width: `${leftPercent}%` }}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner le panneau des types"
        onPointerDown={handlePointerDown("left")}
        className={`group relative z-10 shrink-0 cursor-col-resize border-x ${handleColor} ${dragging === "left" ? "!bg-cyan-200" : ""}`}
        style={{ width: HANDLE_W }}
      >
        <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full transition-colors ${barColor}`} />
      </div>

      <div
        className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden"
        style={{ width: `${centerPercent}%` }}
      >
        {center}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner le panneau des critères"
        onPointerDown={handlePointerDown("center")}
        className={`group relative z-10 shrink-0 cursor-col-resize border-x ${handleColor} ${dragging === "center" ? "!bg-cyan-200" : ""}`}
        style={{ width: HANDLE_W }}
      >
        <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full transition-colors ${barColor}`} />
      </div>

      <div className="flex flex-col h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
