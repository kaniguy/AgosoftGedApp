"use client";

import { useState } from "react";
import { downloadDocumentLocalite } from "../../../services/documentLocalite.service";
import { hasPermission, PERMISSIONS } from "../../../utils/permissions";
import { normalizeAnnotations } from "@/utils/pdfAnnotationUtils";
import { filenameFromDocumentUrl, getFileExtension } from "@/utils/documentFileTypes";
import DocumentPreview from "./DocumentPreview";

function versionFilename(version) {
  const ext = getFileExtension(filenameFromDocumentUrl(version?.fichier_url, "")) || "pdf";
  return `document-v${version?.version_number}.${ext}`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value)
    );
  } catch {
    return "—";
  }
}

/** Liste d'historique des versions (panneau latéral ou modal). */
export function DocumentVersionsPanel({
  documentId,
  versions,
  versionCourante,
  loading,
  onViewVersion,
}) {
  const [downloadingId, setDownloadingId] = useState(null);
  const canDownload = hasPermission(PERMISSIONS.TELECHARGER_DOCUMENT);

  const handleDownload = async (version) => {
    if (!canDownload || !documentId || !version?.id) return;
    setDownloadingId(version.id);
    try {
      await downloadDocumentLocalite(
        { id: documentId },
        versionFilename(version),
        { versionId: version.id }
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <p className="text-xs text-slate-500">
          Version courante : <strong className="text-slate-800">v{versionCourante ?? 1}</strong>
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading ? (
          <p className="text-center text-slate-500 py-8 text-sm">Chargement…</p>
        ) : !versions?.length ? (
          <p className="text-center text-slate-500 py-8 text-sm px-2">
            Aucune version archivée pour l&apos;instant.
          </p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-800">v{v.version_number}</span>
                  {v.fichier_url ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewVersion?.(v)}
                        className="text-xs text-sky-700 hover:underline"
                      >
                        Voir
                      </button>
                      {canDownload && (
                      <button
                        type="button"
                        onClick={() => handleDownload(v)}
                        disabled={downloadingId === v.id}
                        className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
                      >
                        {downloadingId === v.id ? "…" : "Télécharger"}
                      </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-1">{formatDate(v.date_creation)}</p>
                <p className="text-xs text-slate-600 mt-0.5">{v.created_by_nom || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Modal d'aperçu d'une version archivée. */
export function DocumentVersionPreviewModal({ open, version, documentId, onClose }) {
  const canDownload = hasPermission(PERMISSIONS.TELECHARGER_DOCUMENT);
  if (!open || !version) return null;

  const filename = versionFilename(version);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[calc(85*var(--app-vh))] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Aperçu — version v{version.version_number}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDate(version.date_creation)}
              {version.created_by_nom ? ` · ${version.created_by_nom}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canDownload && documentId && version.id ? (
              <button
                type="button"
                onClick={() =>
                  downloadDocumentLocalite(
                    { id: documentId },
                    filename,
                    { versionId: version.id }
                  )
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
              >
                Télécharger
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden p-3 bg-slate-100">
          <DocumentPreview
            key={`version-preview-${version.id}`}
            previewUrl={version.fichier_url}
            previewFileName={filename}
            large
            zoomable
            annotations={normalizeAnnotations(version.annotations)}
            annotationsReadOnly
          />
        </div>
      </div>
    </div>
  );
}

export default function DocumentVersionsModal({
  open,
  onClose,
  documentId,
  versions,
  versionCourante,
  loading,
  onViewVersion,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[calc(80*var(--app-vh))] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Historique des versions</h2>
          <p className="text-sm text-slate-600 mt-1">
            Version courante : <strong>v{versionCourante ?? 1}</strong>
          </p>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <DocumentVersionsPanel
            documentId={documentId}
            versions={versions}
            versionCourante={versionCourante}
            loading={loading}
            onViewVersion={onViewVersion}
          />
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-white"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
