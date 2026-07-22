/**
 * ResizableSplitPane — Composant de mise en page à deux colonnes redimensionnables.
 *
 * Rôle :
 * - Affiche deux panneaux côte à côte (gauche / droite) avec une poignée draggable.
 * - Permet à l'utilisateur d'ajuster la largeur relative des deux zones.
 * - Réutilisé pour le formulaire + aperçu document (rattachement, liste avec preview).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_LEFT = 28;
const MAX_LEFT = 78;
const DEFAULT_LEFT = 52;

export default function ResizableSplitPane({
  left,
  right,
  defaultLeftPercent = DEFAULT_LEFT,
  rightCompact = false,
}) {
  const containerRef = useRef(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [dragging, setDragging] = useState(false);

  // Calcule le pourcentage gauche à partir de la position du curseur
  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setLeftPercent(Math.min(MAX_LEFT, Math.max(MIN_LEFT, ratio)));
  }, []);

  // Démarre le redimensionnement au clic sur la poignée
  const handlePointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);

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
        aria-label="Redimensionner les panneaux"
        onPointerDown={handlePointerDown}
        className={`
          relative z-10 w-2 shrink-0 cursor-col-resize group
          bg-gray-100 hover:bg-emerald-100 border-x border-gray-200
          ${dragging ? "bg-emerald-200" : ""}
        `}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full bg-gray-300 group-hover:bg-emerald-500 transition-colors" />
      </div>

      <div
        className={`flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden ${
          rightCompact ? "self-start max-h-[min(1120px,85vh)] w-full" : "h-full"
        }`}
      >
        {right}
      </div>
    </div>
  );
}
