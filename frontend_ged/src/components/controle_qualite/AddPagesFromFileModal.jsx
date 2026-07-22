/**
 * Modal de sélection des pages à importer depuis un PDF externe.
 */
"use client";

import { useEffect, useState } from "react";
import { getPdfPageCount, parsePageSelection } from "@/utils/pdfPageUtils";

export default function AddPagesFromFileModal({ file, onConfirm, onCancel }) {
  const [pageCount, setPageCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("all");
  const [customSpec, setCustomSpec] = useState("");
  const [singlePage, setSinglePage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const count = await getPdfPageCount(file);
        if (!cancelled) {
          setPageCount(count);
          setSinglePage(1);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Impossible de lire le PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleConfirm = () => {
    try {
      let spec;
      if (mode === "all") spec = "all";
      else if (mode === "single") spec = String(singlePage);
      else spec = customSpec.trim();

      const indices = parsePageSelection(spec, pageCount);
      if (!indices.length) {
        setError("Sélectionnez au moins une page");
        return;
      }
      onConfirm(indices);
    } catch (err) {
      setError(err.message || "Sélection invalide");
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-yellow-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Pages à ajouter</h3>
          <p className="text-xs text-slate-500 mt-1 truncate" title={file?.name}>
            {file?.name}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading && <p className="text-sm text-slate-500">Analyse du PDF…</p>}

          {!loading && pageCount != null && (
            <>
              <p className="text-sm text-slate-600">
                Ce PDF contient <strong>{pageCount}</strong> page{pageCount > 1 ? "s" : ""}.
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="page-mode"
                    checked={mode === "all"}
                    onChange={() => setMode("all")}
                    className="text-yellow-500"
                  />
                  Tout le PDF
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="page-mode"
                    checked={mode === "single"}
                    onChange={() => setMode("single")}
                    className="text-yellow-500"
                  />
                  Une page
                  {mode === "single" && (
                    <select
                      value={singlePage}
                      onChange={(e) => setSinglePage(Number(e.target.value))}
                      className="ml-1 border border-slate-300 rounded px-2 py-1 text-sm"
                    >
                      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Page {n}
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                <label className="flex flex-col gap-1.5 text-sm cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="page-mode"
                      checked={mode === "custom"}
                      onChange={() => setMode("custom")}
                      className="text-yellow-500"
                    />
                    Pages personnalisées
                  </span>
                  {mode === "custom" && (
                    <input
                      type="text"
                      value={customSpec}
                      onChange={(e) => setCustomSpec(e.target.value)}
                      placeholder="Ex. 1,3,5 ou 2-4 ou 1-3,7"
                      className="ml-6 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
                    />
                  )}
                </label>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || pageCount == null}
            className="px-4 py-2 text-sm text-white rounded-lg bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
