"use client";

import { ANNOTATION_COLORS, ANNOTATION_TOOLS } from "@/utils/pdfAnnotationUtils";

const TOOLS = [
  { id: ANNOTATION_TOOLS.HIGHLIGHT, label: "Surligner", icon: "▭" },
  { id: ANNOTATION_TOOLS.RECT, label: "Cadre", icon: "□" },
  { id: ANNOTATION_TOOLS.TEXT, label: "Texte", icon: "T" },
  { id: ANNOTATION_TOOLS.PEN, label: "Dessin", icon: "✎" },
];

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onUndo,
  onRedo,
  onClearPage,
  onDeleteSelected,
  canUndo,
  canRedo = false,
  canDeleteSelected = false,
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-500 font-medium mr-1">Annotations</span>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          title={tool.label}
          onClick={() => onToolChange(tool.id)}
          className={`w-8 h-8 rounded border text-sm font-medium transition ${
            activeTool === tool.id
              ? "bg-amber-100 border-amber-400 text-amber-900"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {tool.icon}
        </button>
      ))}
      <span className="w-px h-6 bg-slate-200 mx-1" />
      {Object.entries(ANNOTATION_COLORS).map(([key, color]) => (
        <button
          key={key}
          type="button"
          title={key}
          onClick={() => onColorChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition ${
            activeColor === color ? "border-slate-800 scale-110" : "border-white shadow"
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
      <span className="w-px h-6 bg-slate-200 mx-1" />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        title="Annuler (Ctrl+Z)"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        title="Rétablir (Ctrl+Y)"
      >
        Rétablir
      </button>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!canDeleteSelected}
        className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40"
        title="Supprimer l'élément sélectionné (Suppr)"
      >
        Supprimer
      </button>
      <button
        type="button"
        onClick={onClearPage}
        className="px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
      >
        Effacer page
      </button>
    </div>
  );
}
