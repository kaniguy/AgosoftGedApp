/**
 * CaptureZoneEditor — Éditeur visuel des zones de capture par champ.
 * Permet d'encadrer sur le document modèle l'emplacement de chaque valeur (style Dokmee Capture).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "@/utils/configurePdfJs";
import { Rnd } from "react-rnd";
import { resolveMediaUrl } from "@/services/api";
import {
  CAPTURE_BASE_PAGE_WIDTH,
  ZONE_OVERLAY_COLORS,
  champHasCaptureZone,
  countZonesByPage,
  normalizedZoneToPixels,
} from "@/utils/captureZoneUtils";
import {
  deleteModeleCapture,
  getCaptureZones,
  saveCaptureZones,
  uploadModeleCapture,
} from "@/services/captureZones.service";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const BASE_PAGE_WIDTH = CAPTURE_BASE_PAGE_WIDTH;
const ACCEPTED_MODELE = ".pdf,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf";

/**
 * Détermine si l'URL ou le nom de fichier correspond à un PDF.
 */
function isPdfSource(url, fileName = "") {
  const source = `${url || ""} ${fileName}`.toLowerCase();
  return source.includes(".pdf");
}

/**
 * Convertit des coordonnées normalisées (0–1) en pixels pour l'affichage.
 */
function normalizedToPixels(zone, pageWidth, pageHeight) {
  return normalizedZoneToPixels(zone, pageWidth, pageHeight);
}

/**
 * Convertit des coordonnées pixels en valeurs normalisées (0–1).
 */
function pixelsToNormalized(x, y, width, height, pageWidth, pageHeight) {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }
  return {
    zone_x: Math.max(0, Math.min(1, x / pageWidth)),
    zone_y: Math.max(0, Math.min(1, y / pageHeight)),
    zone_width: Math.max(0.01, Math.min(1, width / pageWidth)),
    zone_height: Math.max(0.01, Math.min(1, height / pageHeight)),
  };
}

/**
 * Construit l'état initial des zones à partir des champs API.
 */
function buildZonesState(champs) {
  const map = {};
  champs.forEach((champ) => {
    map[champ.id] = {
      champ_id: champ.id,
      capture_page: champ.capture_page ?? 0,
      zone_x: champ.zone_x,
      zone_y: champ.zone_y,
      zone_width: champ.zone_width,
      zone_height: champ.zone_height,
    };
  });
  return map;
}

/**
 * Compte les champs ayant une zone complète sur la page courante.
 */
function countZonesOnPage(zonesMap, pageIndex) {
  return Object.values(zonesMap).filter(
    (z) =>
      z.capture_page === pageIndex &&
      z.zone_x != null &&
      z.zone_y != null &&
      z.zone_width > 0 &&
      z.zone_height > 0
  ).length;
}

export default function CaptureZoneEditor({ typeDocumentId, onNotify, onBack }) {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typeDocument, setTypeDocument] = useState(null);
  const [champs, setChamps] = useState([]);
  const [zonesMap, setZonesMap] = useState({});
  const [activeChampId, setActiveChampId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [previewKind, setPreviewKind] = useState(null);

  const modeleUrl = useMemo(
    () => resolveMediaUrl(typeDocument?.fichier_modele_url),
    [typeDocument?.fichier_modele_url]
  );

  /**
   * Charge les données du type de document et des zones depuis l'API.
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCaptureZones(typeDocumentId);
      setTypeDocument(data.type_document);
      setChamps(data.champs || []);
      setZonesMap(buildZonesState(data.champs || []));
      if (data.champs?.length) {
        setActiveChampId(data.champs[0].id);
      }
      const pages = data.type_document?.modele_page_count || 1;
      setNumPages(Math.max(1, pages));
      setPreviewKind(
        isPdfSource(data.type_document?.fichier_modele_url)
          ? "pdf"
          : data.type_document?.fichier_modele_url
            ? "image"
            : null
      );
    } catch (err) {
      onNotify?.(err.message || "Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  }, [typeDocumentId, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Met à jour la zone d'un champ dans l'état local.
   */
  const updateZoneForChamp = useCallback((champId, patch) => {
    setZonesMap((prev) => ({
      ...prev,
      [champId]: {
        ...prev[champId],
        champ_id: champId,
        ...patch,
      },
    }));
  }, []);

  /**
   * Gère le redimensionnement ou le déplacement d'une zone (react-rnd).
   */
  const handleZoneChange = useCallback(
    (champId, position, size) => {
      const normalized = pixelsToNormalized(
        position.x,
        position.y,
        size.width,
        size.height,
        BASE_PAGE_WIDTH,
        pageHeight
      );
      if (!normalized) return;

      updateZoneForChamp(champId, {
        capture_page: currentPage,
        ...normalized,
      });
    },
    [currentPage, pageHeight, updateZoneForChamp]
  );

  /**
   * Crée une zone par défaut pour un champ (actif ou passé en argument).
   */
  const handleCreateDefaultZone = useCallback(
    (champId = activeChampId) => {
      if (!champId || pageHeight <= 0) return;
      updateZoneForChamp(champId, {
        capture_page: currentPage,
        zone_x: 0.1,
        zone_y: 0.1,
        zone_width: 0.35,
        zone_height: 0.06,
      });
    },
    [activeChampId, currentPage, pageHeight, updateZoneForChamp]
  );

  /**
   * Sélectionne un champ ; crée automatiquement une zone s'il n'en a pas encore.
   */
  const handleSelectChamp = useCallback(
    (champId) => {
      const zone = zonesMap[champId];
      const hasZone = zone?.zone_width > 0 && zone?.zone_height > 0;

      setActiveChampId(champId);

      if (hasZone && zone.capture_page != null) {
        setCurrentPage(zone.capture_page);
        return;
      }

      if (modeleUrl && pageHeight > 0) {
        updateZoneForChamp(champId, {
          capture_page: currentPage,
          zone_x: 0.1,
          zone_y: 0.1,
          zone_width: 0.35,
          zone_height: 0.06,
        });
      }
    },
    [zonesMap, modeleUrl, pageHeight, currentPage, updateZoneForChamp]
  );

  /**
   * Supprime la zone du champ actif sur la page courante.
   */
  const handleClearZone = useCallback(() => {
    if (!activeChampId) return;
    updateZoneForChamp(activeChampId, {
      capture_page: currentPage,
      zone_x: null,
      zone_y: null,
      zone_width: null,
      zone_height: null,
    });
  }, [activeChampId, currentPage, updateZoneForChamp]);

  /**
   * Enregistre toutes les zones via l'API.
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      const zones = Object.values(zonesMap).map((z) => ({
        champ_id: z.champ_id,
        capture_page: z.capture_page ?? 0,
        zone_x: z.zone_x,
        zone_y: z.zone_y,
        zone_width: z.zone_width,
        zone_height: z.zone_height,
      }));
      await saveCaptureZones(typeDocumentId, zones);
      onNotify?.("Zones de capture enregistrées avec succès.", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur d'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Upload un nouveau document modèle.
   */
  const handleUploadModele = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const updated = await uploadModeleCapture(typeDocumentId, file);
      setTypeDocument(updated);
      setNumPages(Math.max(1, updated.modele_page_count || 1));
      setCurrentPage(0);
      setPreviewKind(isPdfSource(updated.fichier_modele_url, file.name) ? "pdf" : "image");
      onNotify?.("Document modèle importé.", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur d'upload", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * Supprime le document modèle actuel.
   */
  const handleDeleteModele = async () => {
    if (!window.confirm("Supprimer le document modèle et toutes les zones associées ?")) {
      return;
    }
    try {
      setUploading(true);
      const updated = await deleteModeleCapture(typeDocumentId);
      setTypeDocument(updated);
      setPreviewKind(null);
      setNumPages(1);
      setCurrentPage(0);
      onNotify?.("Document modèle supprimé.", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur de suppression", "error");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Callback après chargement d'une page PDF (react-pdf).
   */
  const onPageLoadSuccess = (page) => {
    const viewport = page.getViewport({ scale: 1 });
    const scale = BASE_PAGE_WIDTH / viewport.width;
    setPageHeight(viewport.height * scale);
  };

  /**
   * Callback après chargement du document PDF complet.
   */
  const onDocumentLoadSuccess = ({ numPages: total }) => {
    setNumPages(total);
  };

  /**
   * Callback après chargement d'une image modèle.
   */
  const onImageLoad = (e) => {
    const img = e.target;
    const scale = BASE_PAGE_WIDTH / img.naturalWidth;
    setPageHeight(img.naturalHeight * scale);
  };

  const zonesOnCurrentPage = useMemo(
    () =>
      champs.filter((champ) => {
        const z = zonesMap[champ.id];
        return (
          z &&
          z.capture_page === currentPage &&
          z.zone_x != null &&
          z.zone_width > 0
        );
      }),
    [champs, zonesMap, currentPage]
  );

  const champsWithZones = useMemo(
    () => champs.map((champ) => ({ ...champ, ...zonesMap[champ.id] })),
    [champs, zonesMap]
  );

  const pageZoneCounts = useMemo(
    () => countZonesByPage(champsWithZones),
    [champsWithZones]
  );

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-500 text-sm">Chargement de la configuration capture…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          ← Retour
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            Zones de capture — {typeDocument?.libelle}
          </h2>
          <p className="text-xs text-gray-500">
            Encadrez chaque champ sur le modèle. Les coordonnées sont normalisées (indépendantes de la résolution).
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MODELE}
          className="hidden"
          onChange={handleUploadModele}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {modeleUrl ? "Remplacer le modèle" : "Importer un modèle"}
        </button>
        {modeleUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={handleDeleteModele}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer modèle
          </button>
        )}
        <button
          type="button"
          disabled={saving || !champs.length}
          onClick={handleSave}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saving ? "Enregistrement…" : "Enregistrer les zones"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 flex-col lg:flex-row">
        {/* Liste des champs */}
        <div className="w-full lg:w-72 shrink-0 border border-gray-200 rounded-lg overflow-hidden flex flex-col max-h-[40vh] lg:max-h-none">
          <div className="bg-gray-800 text-white text-xs font-semibold px-3 py-2 uppercase tracking-wide">
            Champs ({champs.length})
          </div>
          <div className="overflow-y-auto flex-1">
            {champs.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 italic">
                Aucun champ configuré. Ajoutez des champs depuis la page précédente.
              </p>
            ) : (
              champs.map((champ, index) => {
                const zone = zonesMap[champ.id];
                const hasZone = zone?.zone_width > 0 && zone?.zone_height > 0;
                const isActive = activeChampId === champ.id;
                return (
                  <button
                    key={champ.id}
                    type="button"
                    onClick={() => handleSelectChamp(champ.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 text-sm transition ${
                      isActive ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-gray-800">{champ.libelle_champ}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>{champ.type_champ}</span>
                      {hasZone ? (
                        <span className="text-emerald-600 font-medium">● Zone page {(zone.capture_page ?? 0) + 1}</span>
                      ) : (
                        <span className="text-amber-600">○ Sans zone</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {activeChampId && modeleUrl && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCreateDefaultZone}
                className="w-full px-2 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Ajouter / réinitialiser zone
              </button>
              <button
                type="button"
                onClick={handleClearZone}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-white text-gray-600"
              >
                Effacer zone du champ
              </button>
            </div>
          )}
        </div>

        {/* Aperçu document + zones */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden flex flex-col bg-slate-100">
          {!modeleUrl ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
              <p className="text-sm mb-4">Importez un document modèle (PDF ou image) pour commencer l'encadrement.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Importer un modèle
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 text-xs text-gray-600 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {numPages > 1 && (
                    <select
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                      aria-label="Sélectionner une page"
                    >
                      {Array.from({ length: numPages }, (_, index) => (
                        <option key={index} value={index}>
                          Page {index + 1}
                          {pageZoneCounts[index] ? ` — ${pageZoneCounts[index]} zone(s)` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <span>
                    Page {currentPage + 1} / {numPages} — {countZonesOnPage(zonesMap, currentPage)} zone(s) sur cette page
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= numPages - 1}
                    onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 flex justify-center">
                <div
                  className="relative bg-white shadow-md"
                  style={{ width: BASE_PAGE_WIDTH, height: pageHeight || "auto", minHeight: 200 }}
                >
                  {previewKind === "pdf" ? (
                    <Document file={modeleUrl} onLoadSuccess={onDocumentLoadSuccess} loading="">
                      <Page
                        pageNumber={currentPage + 1}
                        width={BASE_PAGE_WIDTH}
                        onLoadSuccess={onPageLoadSuccess}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  ) : (
                    <img
                      src={modeleUrl}
                      alt="Modèle de capture"
                      className="block w-full h-auto"
                      onLoad={onImageLoad}
                      draggable={false}
                    />
                  )}

                  {pageHeight > 0 &&
                    zonesOnCurrentPage.map((champ, index) => {
                      const zone = zonesMap[champ.id];
                      const pixels = normalizedToPixels(zone, BASE_PAGE_WIDTH, pageHeight);
                      const isActive = champ.id === activeChampId;
                      const palette = ZONE_OVERLAY_COLORS[index % ZONE_OVERLAY_COLORS.length];
                      const colorClass = `${palette.border} ${palette.bg}`;

                      return (
                        <Rnd
                          key={champ.id}
                          size={{ width: pixels.width, height: pixels.height }}
                          position={{ x: pixels.x, y: pixels.y }}
                          bounds="parent"
                          enableResizing={isActive}
                          disableDragging={!isActive}
                          onMouseDown={() => setActiveChampId(champ.id)}
                          onDragStop={(_e, d) =>
                            handleZoneChange(champ.id, { x: d.x, y: d.y }, {
                              width: pixels.width,
                              height: pixels.height,
                            })
                          }
                          onResizeStop={(_e, _dir, ref, _delta, position) =>
                            handleZoneChange(
                              champ.id,
                              position,
                              {
                                width: parseFloat(ref.style.width),
                                height: parseFloat(ref.style.height),
                              }
                            )
                          }
                          className={`border-2 cursor-pointer ${colorClass} ${isActive ? "z-20 ring-2 ring-blue-400" : "z-10 opacity-70"}`}
                        />
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
