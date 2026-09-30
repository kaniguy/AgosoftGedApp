"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANNOTATION_TOOLS,
  STAMP_LABELS,
  DEFAULT_STAMP_SIZE,
  DEFAULT_SIGNATURE_SIZE,
  canMoveAnnotation,
  canTransformAnnotation,
  applyMove,
  applyResizeCorner,
  clampBox,
  createAnnotationId,
  getAnnotationBox,
  getImageAnnotationSizeLimits,
  pointerAngleDeg,
  normalizeRotation,
} from "@/utils/pdfAnnotationUtils";
import { cssZoomOf } from "@/utils/appZoom";
import AnnotationTextEditor from "./AnnotationTextEditor";

function annOnPage(annotations, pageIndex) {
  return (annotations || []).filter((a) => (a.page ?? 0) === pageIndex);
}

const CORNER_HANDLES = [
  { corner: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { corner: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { corner: "sw", className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
  { corner: "se", className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
];

function TransformHandles({ onResizeStart, onRotateStart }) {
  return (
    <>
      {CORNER_HANDLES.map(({ corner, className }) => (
        <div
          key={corner}
          role="presentation"
          onPointerDown={(e) => onResizeStart(e, corner)}
          className={`absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-amber-500 shadow z-30 touch-none ${className}`}
        />
      ))}
      <div
        role="presentation"
        onPointerDown={onRotateStart}
        title="Faire pivoter"
        className="absolute left-1/2 -top-7 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow cursor-grab active:cursor-grabbing z-30 touch-none flex items-center justify-center text-[9px] text-white font-bold"
      >
        ↻
      </div>
      <div className="absolute left-1/2 -top-7 -translate-x-1/2 w-px h-4 bg-amber-400 -z-10 pointer-events-none" />
    </>
  );
}

function BoxShell({
  ann,
  pageWidth,
  pageHeight,
  layerRectRef,
  selected,
  selectMode,
  transformable,
  movable,
  zIndex,
  cursor,
  onSelect,
  onUpdate,
  onTransformEnd,
  onStartTextEdit,
  onDelete,
  children,
}) {
  const dragRef = useRef(null);
  const onTransformEndRef = useRef(onTransformEnd);
  onTransformEndRef.current = onTransformEnd;
  const box = getAnnotationBox(ann);
  const rotation = ann.rotation ?? 0;

  useEffect(() => {
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const { orig, origBox, mode, corner, startAngle, centerX, centerY, origRotation, zoom } = dragRef.current;
      const dx = (e.clientX - dragRef.current.startClientX) / zoom / pageWidth;
      const dy = (e.clientY - dragRef.current.startClientY) / zoom / pageHeight;

      if (mode === "move") {
        dragRef.current.dirty = true;
        onUpdate({ ...orig, ...applyMove(origBox, dx, dy) }, { recordHistory: false });
        return;
      }

      if (mode === "resize" && corner) {
        dragRef.current.dirty = true;
        const lockAspect = orig.type === "stamp" || orig.type === "signature";
        const limits = getImageAnnotationSizeLimits(orig.type);
        onUpdate(
          {
            ...orig,
            ...applyResizeCorner(origBox, dx, dy, corner, orig.rotation ?? 0, {
              lockAspectRatio: lockAspect,
              minWidth: limits?.minWidth,
              maxWidth: limits?.maxWidth,
            }),
          },
          { recordHistory: false }
        );
        return;
      }

      if (mode === "rotate") {
        dragRef.current.dirty = true;
        const currentAngle = pointerAngleDeg(centerX, centerY, e.clientX, e.clientY);
        const delta = currentAngle - startAngle;
        onUpdate(
          {
            ...orig,
            rotation: normalizeRotation(origRotation + delta),
          },
          { recordHistory: false }
        );
      }
    };

    const endDrag = () => {
      if (!dragRef.current) return;
      const { dirty, mode } = dragRef.current;
      dragRef.current = null;
      if (dirty && (mode === "move" || mode === "resize" || mode === "rotate")) {
        onTransformEndRef.current?.();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [pageWidth, pageHeight, onUpdate]);

  if (!box) return null;

  const width = Math.max(box.width * pageWidth, 8);
  const height = Math.max(box.height * pageHeight, 8);
  const centerLeft = (box.x + box.width / 2) * pageWidth;
  const centerTop = (box.y + box.height / 2) * pageHeight;

  const startDrag = (e, mode, corner = null) => {
    if (!movable && mode === "move") return;
    if (!transformable && mode !== "move") return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(ann.id);

    const layerRect = layerRectRef.current?.getBoundingClientRect();
    const zoom = cssZoomOf(layerRectRef.current);
    const centerX = layerRect ? layerRect.left + centerLeft * zoom : centerLeft;
    const centerY = layerRect ? layerRect.top + centerTop * zoom : centerTop;

    dragRef.current = {
      mode,
      corner,
      zoom,
      startClientX: e.clientX,
      startClientY: e.clientY,
      orig: { ...ann },
      origBox: getAnnotationBox(ann),
      centerX,
      centerY,
      startAngle: pointerAngleDeg(centerX, centerY, e.clientX, e.clientY),
      origRotation: ann.rotation ?? 0,
      dirty: false,
    };
  };

  return (
    <div
      style={{
        position: "absolute",
        left: centerLeft,
        top: centerTop,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex,
        cursor,
      }}
      className="touch-none pointer-events-auto"
      onPointerDown={(e) => {
        // Sélection dynamique : cliquer un élément permet de le déplacer immédiatement
        startDrag(e, "move");
      }}
      onDoubleClick={(e) => {
        if (ann.type !== "text") return;
        e.stopPropagation();
        onStartTextEdit?.(ann);
      }}
    >
      {children}
      {selected && (
        <button
          type="button"
          title="Supprimer"
          aria-label="Supprimer l'élément"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete?.(ann.id);
          }}
          className="absolute -right-2.5 -top-2.5 z-40 w-6 h-6 rounded-full bg-red-600 text-white text-sm leading-none border-2 border-white shadow hover:bg-red-700 flex items-center justify-center"
        >
          ×
        </button>
      )}
      {selected && transformable && (
        <TransformHandles
          onResizeStart={(e, corner) => startDrag(e, "resize", corner)}
          onRotateStart={(e) => startDrag(e, "rotate")}
        />
      )}
    </div>
  );
}

function AnnotationItem({
  ann,
  pageWidth,
  pageHeight,
  layerRectRef,
  selected,
  selectMode,
  onSelect,
  onUpdate,
  onTransformEnd,
  onStartTextEdit,
  onDelete,
}) {
  const color = ann.color || "#212121";
  const transformable = canTransformAnnotation(ann);
  const movable = canMoveAnnotation(ann);
  const zIndex = selected ? 20 : 10;

  if (ann.type === "pen" && ann.points?.length) {
    const points = ann.points
      .map(([x, y]) => `${x * pageWidth},${y * pageHeight}`)
      .join(" ");
    return (
      <svg
        key={ann.id}
        className="absolute inset-0 pointer-events-none"
        width={pageWidth}
        height={pageHeight}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={ann.strokeWidth || 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={selected ? 1 : 0.9}
        />
      </svg>
    );
  }

  if (ann.type === "highlight") {
    return (
      <BoxShell
        ann={ann}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        layerRectRef={layerRectRef}
        selected={selected}
        selectMode={selectMode}
        transformable={transformable}
        movable={movable}
        zIndex={zIndex}
        cursor="move"
        onSelect={onSelect}
        onUpdate={onUpdate}
        onTransformEnd={onTransformEnd}
        onStartTextEdit={onStartTextEdit}
        onDelete={onDelete}
      >
        <div
          className="w-full h-full pointer-events-none"
          style={{
            backgroundColor: color,
            opacity: 0.4,
            outline: selected ? "2px solid #f59e0b" : "none",
          }}
        />
      </BoxShell>
    );
  }

  if (ann.type === "rect") {
    return (
      <BoxShell
        ann={ann}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        layerRectRef={layerRectRef}
        selected={selected}
        selectMode={selectMode}
        transformable={transformable}
        movable={movable}
        zIndex={zIndex}
        cursor="move"
        onSelect={onSelect}
        onUpdate={onUpdate}
        onTransformEnd={onTransformEnd}
        onStartTextEdit={onStartTextEdit}
        onDelete={onDelete}
      >
        <div
          className="w-full h-full pointer-events-none"
          style={{
            border: `2px solid ${color}`,
            outline: selected ? "2px dashed #f59e0b" : "none",
          }}
        />
      </BoxShell>
    );
  }

  if (ann.type === "stamp") {
    return (
      <BoxShell
        ann={ann}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        layerRectRef={layerRectRef}
        selected={selected}
        selectMode={selectMode}
        transformable={transformable}
        movable={movable}
        zIndex={zIndex}
        cursor="move"
        onSelect={onSelect}
        onUpdate={onUpdate}
        onTransformEnd={onTransformEnd}
        onStartTextEdit={onStartTextEdit}
        onDelete={onDelete}
      >
        {ann.imageData ? (
          <div
            className="w-full h-full pointer-events-none flex items-center justify-center"
            style={{
              outline: selected ? "2px dashed #f59e0b" : "none",
              outlineOffset: 2,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ann.imageData}
              alt={ann.text || "Tampon"}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center select-none pointer-events-none"
            style={{
              color,
              border: `2.5px solid ${color}`,
              borderRadius: 0,
              background: "transparent",
              boxShadow: selected ? "0 0 0 2px rgba(245, 158, 11, 0.35)" : "none",
            }}
          >
            <span
              className="block w-full text-center leading-none px-1"
              style={{
                fontWeight: 800,
                fontSize: Math.max(10, Math.min(14, Math.max(boxHeight(ann, pageHeight), 8) * 0.38)),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {ann.text}
            </span>
          </div>
        )}
      </BoxShell>
    );
  }

  if (ann.type === "signature" && ann.imageData) {
    return (
      <BoxShell
        ann={ann}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        layerRectRef={layerRectRef}
        selected={selected}
        selectMode={selectMode}
        transformable={transformable}
        movable={movable}
        zIndex={zIndex}
        cursor="move"
        onSelect={onSelect}
        onUpdate={onUpdate}
        onTransformEnd={onTransformEnd}
        onStartTextEdit={onStartTextEdit}
        onDelete={onDelete}
      >
        <div
          className="w-full h-full pointer-events-none flex items-center justify-center"
          style={{
            outline: selected ? "2px dashed #f59e0b" : "none",
            outlineOffset: 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ann.imageData}
            alt="Signature"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
      </BoxShell>
    );
  }

  if (ann.type === "text") {
    return (
      <BoxShell
        ann={ann}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        layerRectRef={layerRectRef}
        selected={selected}
        selectMode={selectMode}
        transformable={transformable}
        movable={movable}
        zIndex={zIndex}
        cursor="move"
        onSelect={onSelect}
        onUpdate={onUpdate}
        onTransformEnd={onTransformEnd}
        onStartTextEdit={onStartTextEdit}
        onDelete={onDelete}
      >
        <div
          className="w-full h-full flex items-start justify-start pointer-events-none px-1 py-0.5"
          style={{
            color,
            fontWeight: 500,
            fontSize: 12,
            outline: selected ? "2px solid #f59e0b" : "none",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {ann.text}
        </div>
      </BoxShell>
    );
  }

  return null;
}

function boxHeight(ann, pageHeight) {
  return (getAnnotationBox(ann)?.height ?? 0.04) * pageHeight;
}

export default function PdfAnnotationsLayer({
  pageIndex,
  pageWidth,
  pageHeight,
  annotations,
  onChange,
  activeTool,
  activeColor,
  stampKey = "approuve",
  stampImageData = null,
  stampText = null,
  stampColor = null,
  onRequestStamp,
  signatureImageData = null,
  onRequestSignature,
  selectedId,
  onSelect,
  onDeleteAnnotation,
  onHistoryCommit,
  readOnly = false,
}) {
  const layerRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const penPointsRef = useRef([]);
  const draftRef = useRef(null);
  const selectMode = activeTool === ANNOTATION_TOOLS.SELECT;

  draftRef.current = draft;

  const deleteAnnotation = useCallback(
    (id) => {
      if (!id) return;
      onChange?.((annotations || []).filter((a) => a.id !== id));
      if (selectedId === id) onSelect?.(null);
      onDeleteAnnotation?.(id);
    },
    [annotations, onChange, onSelect, selectedId, onDeleteAnnotation]
  );

  useEffect(() => {
    if (readOnly) return undefined;
    const onKeyDown = (e) => {
      if (!selectedId || textEditor) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      deleteAnnotation(selectedId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, textEditor, readOnly, deleteAnnotation]);

  const toNorm = useCallback((clientX, clientY) => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const updateAnnotation = useCallback(
    (updated, options = {}) => {
      if (!updated?.id) return;
      onChange?.(
        (annotations || []).map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
        options
      );
    },
    [annotations, onChange]
  );

  const commitAnnotation = useCallback(
    (ann) => {
      if (!ann) return;
      onChange?.([...(annotations || []), ann]);
      setDraft(null);
      penPointsRef.current = [];
      if (
        ann.type === "stamp" ||
        ann.type === "signature" ||
        ann.type === "rect" ||
        ann.type === "text"
      ) {
        onSelect?.(ann.id);
      }
    },
    [annotations, onChange, onSelect]
  );

  const openTextEditor = useCallback(
    (annOrCoords) => {
      if (annOrCoords?.id) {
        const ann = annOrCoords;
        onSelect?.(ann.id);
        setTextEditor({
          x: ann.x ?? 0,
          y: ann.y ?? 0,
          text: ann.text || "",
          editingId: ann.id,
          color: ann.color || activeColor,
        });
        return;
      }
      const { x, y } = annOrCoords;
      setTextEditor({
        x,
        y,
        text: "",
        editingId: null,
        color: activeColor,
      });
      onSelect?.(null);
    },
    [activeColor, onSelect]
  );

  const closeTextEditor = useCallback(() => {
    setTextEditor(null);
  }, []);

  const saveTextEditor = useCallback(
    (text) => {
      if (!textEditor) return;
      if (textEditor.editingId) {
        updateAnnotation({
          id: textEditor.editingId,
          text,
          color: textEditor.color || activeColor,
        });
      } else {
        commitAnnotation({
          id: createAnnotationId(),
          type: "text",
          page: pageIndex,
          x: textEditor.x,
          y: textEditor.y,
          width: 0.18,
          height: 0.04,
          rotation: 0,
          text,
          color: textEditor.color || activeColor,
        });
      }
      setTextEditor(null);
    },
    [textEditor, updateAnnotation, commitAnnotation, pageIndex, activeColor]
  );

  useEffect(() => {
    if (!draft || draft.type !== "pen") return undefined;

    const minPointDistance = 0.0015;

    const onPointerMove = (e) => {
      if (e.buttons === 0) return;
      const { x, y } = toNorm(e.clientX, e.clientY);
      const points = penPointsRef.current;
      const last = points[points.length - 1];
      if (last && Math.hypot(x - last[0], y - last[1]) < minPointDistance) return;
      const next = [...points, [x, y]];
      penPointsRef.current = next;
      setDraft((current) => (current?.type === "pen" ? { ...current, points: next } : current));
    };

    const endPenStroke = () => {
      const currentDraft = draftRef.current;
      const points = penPointsRef.current;
      if (!currentDraft || currentDraft.type !== "pen") return;
      if (points.length > 1) {
        commitAnnotation({ ...currentDraft, points: [...points] });
      } else {
        setDraft(null);
        penPointsRef.current = [];
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endPenStroke);
    window.addEventListener("pointercancel", endPenStroke);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endPenStroke);
      window.removeEventListener("pointercancel", endPenStroke);
    };
  }, [draft?.id, draft?.type, toNorm, commitAnnotation]);

  const handleLayerPointerDown = (e) => {
    if (textEditor) return;
    if (e.target !== e.currentTarget) return;
    if (!activeTool || pageWidth <= 0 || pageHeight <= 0) return;
    const { x, y } = toNorm(e.clientX, e.clientY);

    if (activeTool === ANNOTATION_TOOLS.SELECT) {
      onSelect?.(null);
      return;
    }

    if (activeTool === ANNOTATION_TOOLS.TEXT) {
      openTextEditor({ x, y });
      return;
    }

    if (activeTool === ANNOTATION_TOOLS.STAMP) {
      if (!stampImageData && !STAMP_LABELS[stampKey] && !stampText) {
        onRequestStamp?.();
        return;
      }
      const box = clampBox({
        x: x - DEFAULT_STAMP_SIZE.width / 2,
        y: y - DEFAULT_STAMP_SIZE.height / 2,
        width: stampImageData ? DEFAULT_STAMP_SIZE.width * 1.25 : DEFAULT_STAMP_SIZE.width,
        height: stampImageData ? DEFAULT_STAMP_SIZE.height * 1.25 : DEFAULT_STAMP_SIZE.height,
      });
      commitAnnotation({
        id: createAnnotationId(),
        type: "stamp",
        page: pageIndex,
        ...box,
        rotation: 0,
        text: stampText || STAMP_LABELS[stampKey] || STAMP_LABELS.approuve,
        color: stampColor || activeColor,
        ...(stampImageData ? { imageData: stampImageData } : {}),
      });
      return;
    }

    if (activeTool === ANNOTATION_TOOLS.SIGNATURE) {
      if (!signatureImageData) {
        onRequestSignature?.();
        return;
      }
      const box = clampBox({
        x: x - DEFAULT_SIGNATURE_SIZE.width / 2,
        y: y - DEFAULT_SIGNATURE_SIZE.height / 2,
        width: DEFAULT_SIGNATURE_SIZE.width,
        height: DEFAULT_SIGNATURE_SIZE.height,
      });
      commitAnnotation({
        id: createAnnotationId(),
        type: "signature",
        page: pageIndex,
        ...box,
        rotation: 0,
        imageData: signatureImageData,
      });
      return;
    }

    if (activeTool === ANNOTATION_TOOLS.PEN) {
      penPointsRef.current = [[x, y]];
      setDraft({
        id: createAnnotationId(),
        type: "pen",
        page: pageIndex,
        points: [[x, y]],
        color: activeColor,
        strokeWidth: 2,
      });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    setDraft({
      id: createAnnotationId(),
      type: activeTool === ANNOTATION_TOOLS.HIGHLIGHT ? "highlight" : "rect",
      page: pageIndex,
      x,
      y,
      width: 0,
      height: 0,
      rotation: 0,
      color: activeColor,
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleLayerPointerMove = (e) => {
    if (!draft || draft.type === "pen") return;
    const { x, y } = toNorm(e.clientX, e.clientY);

    const x0 = draft.x;
    const y0 = draft.y;
    setDraft({
      ...draft,
      x: Math.min(x0, x),
      y: Math.min(y0, y),
      width: Math.abs(x - x0),
      height: Math.abs(y - y0),
    });
  };

  const handleLayerPointerUp = () => {
    if (!draft || draft.type === "pen") return;
    if ((draft.width || 0) > 0.005 && (draft.height || 0) > 0.005) {
      const box = clampBox(draft);
      commitAnnotation({ ...draft, ...box });
    } else {
      setDraft(null);
    }
  };

  if (pageWidth <= 0 || pageHeight <= 0) return null;

  const pageAnns = annOnPage(annotations, pageIndex);

  if (readOnly) {
    return (
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ width: pageWidth, height: pageHeight }}
      >
        {pageAnns.map((ann) => (
          <AnnotationItem
            key={ann.id}
            ann={ann}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            layerRectRef={layerRef}
            selected={false}
            selectMode={false}
            onSelect={() => {}}
            onUpdate={() => {}}
          />
        ))}
      </div>
    );
  }

  const renderDraftPreview = () => {
    if (!draft) return null;
    if (draft.type === "pen") {
      return (
        <AnnotationItem
          ann={draft}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          layerRectRef={layerRef}
          selected={false}
          selectMode={false}
          onSelect={onSelect}
          onUpdate={() => {}}
        />
      );
    }
    const box = clampBox({
      x: draft.x ?? 0,
      y: draft.y ?? 0,
      width: draft.width ?? 0.01,
      height: draft.height ?? 0.01,
    });
    const left = box.x * pageWidth;
    const top = box.y * pageHeight;
    const width = Math.max(box.width * pageWidth, 4);
    const height = Math.max(box.height * pageHeight, 4);
    const color = draft.color || activeColor;
    if (draft.type === "highlight") {
      return (
        <div
          style={{
            position: "absolute",
            left,
            top,
            width,
            height,
            backgroundColor: color,
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />
      );
    }
    return (
      <div
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          border: `2px solid ${color}`,
          pointerEvents: "none",
        }}
      />
    );
  };

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 z-20 ${selectMode ? "pointer-events-none" : ""}`}
      style={{ width: pageWidth, height: pageHeight }}
      onPointerDown={selectMode ? undefined : handleLayerPointerDown}
      onPointerMove={selectMode ? undefined : handleLayerPointerMove}
      onPointerUp={selectMode ? undefined : handleLayerPointerUp}
      onPointerLeave={
        selectMode
          ? undefined
          : () => {
              if (draft?.type === "pen") return;
              handleLayerPointerUp();
            }
      }
    >
      {pageAnns
        .filter((ann) => !(textEditor?.editingId && ann.id === textEditor.editingId))
        .map((ann) => (
          <AnnotationItem
            key={ann.id}
            ann={ann}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            layerRectRef={layerRef}
            selected={ann.id === selectedId}
            selectMode={selectMode}
            onSelect={onSelect}
            onUpdate={updateAnnotation}
            onTransformEnd={onHistoryCommit}
            onStartTextEdit={openTextEditor}
            onDelete={deleteAnnotation}
          />
        ))}
      {textEditor && (
        <AnnotationTextEditor
          left={textEditor.x * pageWidth}
          top={textEditor.y * pageHeight}
          initialText={textEditor.text}
          color={textEditor.color || activeColor}
          onSave={saveTextEditor}
          onCancel={closeTextEditor}
        />
      )}
      {renderDraftPreview()}
    </div>
  );
}
