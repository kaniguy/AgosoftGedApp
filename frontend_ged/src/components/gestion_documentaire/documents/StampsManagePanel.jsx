"use client";

import { useCallback, useEffect, useState } from "react";
import StampCreateModal from "./StampCreateModal";
import {
  ANNOTATION_COLORS,
  STAMP_DEFAULT_COLORS,
  STAMP_LABELS,
} from "@/utils/pdfAnnotationUtils";

const STORAGE_KEY = "ged_custom_stamps";

const DEFAULT_STAMPS = Object.entries(STAMP_LABELS).map(([key, label]) => ({
  id: `default-${key}`,
  kind: "default",
  key,
  label,
  text: label,
  color: STAMP_DEFAULT_COLORS[key] || "#212121",
}));

function readCustomStamps() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeCustomStamps(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Gestion des tampons (prédéfinis + personnalisés locaux, non liés au compte).
 */
export default function StampsManagePanel({
  selectedId = null,
  selectedColor = null,
  onSelect,
  onColorChange,
  onNotify,
}) {
  const [customStamps, setCustomStamps] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const refresh = useCallback(() => {
    setCustomStamps(readCustomStamps());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedStamp =
    DEFAULT_STAMPS.find((s) => s.id === selectedId) ||
    customStamps.find((s) => s.id === selectedId) ||
    null;

  const activeColor =
    selectedColor ||
    selectedStamp?.color ||
    STAMP_DEFAULT_COLORS.approuve;

  const handleCreated = ({ dataUrl, label, text }) => {
    const next = [
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "custom",
        label: label || text || "Tampon",
        text: text || label || "Tampon",
        imageData: dataUrl,
        createdAt: new Date().toISOString(),
      },
      ...readCustomStamps(),
    ];
    writeCustomStamps(next);
    setCustomStamps(next);
    setShowModal(false);
    onSelect?.(next[0].id, next[0]);
    onNotify?.("Tampon personnalisé créé", "success");
  };

  const handleDelete = (stamp) => {
    if (!window.confirm("Supprimer ce tampon personnalisé ?")) return;
    const next = readCustomStamps().filter((s) => s.id !== stamp.id);
    writeCustomStamps(next);
    setCustomStamps(next);
    if (selectedId === stamp.id) onSelect?.(null, null);
    onNotify?.("Tampon supprimé", "success");
  };

  const handlePickDefault = (stamp) => {
    onSelect?.(stamp.id, { ...stamp, color: stamp.color });
    onColorChange?.(stamp.color);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 space-y-2 shrink-0">
        <p className="text-xs text-slate-500">
          Sélectionnez un tampon puis cliquez sur le document pour le placer. Cliquez un élément
          déjà placé pour le déplacer. Les tampons personnalisés restent sur cet appareil.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500"
        >
          + Nouveau tampon
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-1">
          Prédéfinis
        </p>
        {DEFAULT_STAMPS.map((stamp) => {
          const isSelected = selectedId === stamp.id;
          return (
            <button
              key={stamp.id}
              type="button"
              onClick={() => handlePickDefault(stamp)}
              className={`w-full border-2 px-3 py-2.5 text-left text-sm font-bold tracking-wide uppercase transition ${
                isSelected ? "ring-2 ring-offset-1 ring-amber-400" : "hover:opacity-90"
              }`}
              style={{
                color: stamp.color,
                borderColor: stamp.color,
                backgroundColor: isSelected ? `${stamp.color}14` : "#fff",
                borderRadius: 0,
              }}
            >
              {stamp.label}
            </button>
          );
        })}

        {selectedStamp?.kind === "default" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-[11px] font-medium text-slate-600">
              Couleur du tampon « {selectedStamp.label} »
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="Couleur par défaut"
                onClick={() => onColorChange?.(selectedStamp.color)}
                className={`w-7 h-7 rounded-full border-2 transition ${
                  activeColor === selectedStamp.color
                    ? "border-slate-800 scale-110"
                    : "border-white shadow"
                }`}
                style={{ backgroundColor: selectedStamp.color }}
              />
              {Object.entries(ANNOTATION_COLORS).map(([key, color]) => (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => onColorChange?.(color)}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    activeColor === color ? "border-slate-800 scale-110" : "border-white shadow"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Couleur active :{" "}
              <span className="font-semibold" style={{ color: activeColor }}>
                {selectedStamp.label}
              </span>
            </p>
          </div>
        )}

        {customStamps.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-1 pt-2">
              Personnalisés
            </p>
            {customStamps.map((stamp) => {
              const isSelected = selectedId === stamp.id;
              return (
                <div
                  key={stamp.id}
                  className={`rounded-lg border p-2 transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect?.(stamp.id, stamp)}
                    className="w-full flex items-center justify-center min-h-[56px] bg-slate-50 rounded-md border border-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stamp.imageData}
                      alt={stamp.label}
                      className="max-h-12 max-w-full object-contain"
                    />
                  </button>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-slate-700 truncate">{stamp.label}</span>
                    <button
                      type="button"
                      title="Supprimer"
                      onClick={() => handleDelete(stamp)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  {isSelected && (
                    <p className="mt-1 text-[10px] text-amber-800 font-medium text-center">
                      Actif — cliquez sur le PDF
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <StampCreateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
