"use client";

import { useEffect, useRef, useState } from "react";

export default function AnnotationTextEditor({
  left,
  top,
  initialText = "",
  color = "#212121",
  onSave,
  onCancel,
}) {
  const [value, setValue] = useState(initialText);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel?.();
      return;
    }
    onSave(trimmed);
  };

  return (
    <div
      className="absolute z-50 min-w-[200px] max-w-[min(320px,90vw)] rounded-lg border border-amber-300 bg-white shadow-lg p-2"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <label className="block text-[10px] font-medium text-slate-500 mb-1">Texte de l&apos;annotation</label>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
        style={{ color }}
        placeholder="Saisissez votre texte…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-2.5 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600"
        >
          Valider
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Ctrl+Entrée pour valider · Échap pour annuler</p>
    </div>
  );
}
