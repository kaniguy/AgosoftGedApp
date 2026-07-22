"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDocumentsParLocalite } from "../../services/documentLocalite.service";
import { STATUT_VALIDE } from "../../utils/documentStatutQualite";
import {
  canOpenDocumentQc,
  getQcActionLabel,
} from "../../utils/controleQualitePermissions";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PersonCell({ person }) {
  if (!person?.nom) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-0">
      <p className="text-sm text-slate-800 truncate">{person.nom}</p>
      {person.email && <p className="text-xs text-slate-500 truncate">{person.email}</p>}
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CasierDocumentsTable({ documents, statut, localiteId, statutConfig, highlightedDocId }) {
  const router = useRouter();
  const btnPrimary =
    "px-3 py-1.5 text-xs font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg disabled:opacity-50";
  const btnSecondary =
    "px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 rounded-lg";

  const goToDocument = (docId) => {
    if (!canOpenDocumentQc(statut)) return;
    router.push(`/controle_qualite/validation/${localiteId}/${docId}?statut=${statut}`);
  };

  if (!documents.length) {
    return (
      <p className="px-4 py-6 text-sm text-slate-400 text-center bg-slate-50/80">
        Aucun document pour ce casier.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-amber-900 bg-gradient-to-r from-amber-100 to-yellow-100">
            <th className="px-4 py-2.5 font-semibold">Type de document</th>
            <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Date d&apos;enregistrement</th>
            <th className="px-4 py-2.5 font-semibold">Importé par</th>
            {statut === "rejete" && (
              <>
                <th className="px-4 py-2.5 font-semibold">Rejeté par</th>
                <th className="px-4 py-2.5 font-semibold">Motif</th>
              </>
            )}
            {statut === STATUT_VALIDE && (
              <>
                <th className="px-4 py-2.5 font-semibold">Validé par</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Date validation</th>
              </>
            )}
            <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const highlighted = highlightedDocId && Number(highlightedDocId) === Number(doc.id);
            return (
              <tr
                key={doc.id}
                className={`hover:bg-yellow-50/60 ${highlighted ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : "bg-white"}`}
              >
                <td className="px-4 py-2.5 align-top">
                  <p className="font-medium text-slate-800">{doc.type_document_libelle || "—"}</p>
                  <p className="text-xs text-slate-500">#{doc.id}</p>
                </td>
                <td className="px-4 py-2.5 align-top whitespace-nowrap text-slate-600">
                  {formatDate(doc.date_creation)}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <PersonCell person={doc.importe_par} />
                </td>
                {statut === "rejete" && (
                  <>
                    <td className="px-4 py-2.5 align-top">
                      <PersonCell person={doc.rejete_par_info} />
                    </td>
                    <td className="px-4 py-2.5 align-top text-xs text-slate-600 line-clamp-2">
                      {doc.motif_rejet || "—"}
                    </td>
                  </>
                )}
                {statut === STATUT_VALIDE && (
                  <>
                    <td className="px-4 py-2.5 align-top">
                      <PersonCell person={doc.valide_par_info} />
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap text-slate-600">
                      {formatDate(doc.valide_le)}
                    </td>
                  </>
                )}
                <td className="px-4 py-2.5 align-top">
                  <button
                    type="button"
                    onClick={() => goToDocument(doc.id)}
                    disabled={!canOpenDocumentQc(statut)}
                    className={statut === STATUT_VALIDE ? btnSecondary : btnPrimary}
                  >
                    {getQcActionLabel(statut)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CasierRow({
  casier,
  statut,
  statutConfig,
  expanded,
  onToggle,
  documentsState,
  onLoadDocuments,
  highlighted,
}) {
  const open = expanded.has(Number(casier.id));
  const cache = documentsState[Number(casier.id)];

  useEffect(() => {
    if (open && !cache) {
      onLoadDocuments(casier.id);
    }
  }, [open, cache, casier.id, onLoadDocuments]);

  return (
    <div
      id={`casier-${casier.id}`}
      className={`border-b border-slate-100 last:border-b-0 ${highlighted ? "bg-yellow-50/80 ring-1 ring-inset ring-yellow-300" : ""}`}
    >
      <button
        type="button"
        onClick={() => onToggle(casier.id)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-yellow-50/50 transition"
      >
        <ChevronIcon open={open} />
        <span className="shrink-0 text-yellow-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-medium text-slate-800">{casier.libelle}</span>
          {casier.code && (
            <span className="ml-2 text-xs text-yellow-700 font-medium">{casier.code}</span>
          )}
          {casier.chemin && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5" title={casier.chemin}>
              {casier.chemin}
            </p>
          )}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statutConfig.badgeClass}`}>
          {casier.nbDocuments}
        </span>
      </button>

      {open && (
        <>
          {cache?.loading && (
            <p className="px-6 py-4 text-sm text-slate-400 bg-slate-50/80 border-t border-slate-100">
              Chargement des documents…
            </p>
          )}
          {cache?.error && (
            <p className="px-6 py-4 text-sm text-red-600 bg-red-50 border-t border-red-100">{cache.error}</p>
          )}
          {cache?.documents && (
            <CasierDocumentsTable
              documents={cache.documents}
              statut={statut}
              localiteId={casier.id}
              statutConfig={statutConfig}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function ControleQualiteArborescence({
  casiers = [],
  statut,
  statutConfig,
  highlightCasierId = null,
  typeDocumentId = "",
  columnFilters = {},
}) {
  const [expandedCasiers, setExpandedCasiers] = useState(() => new Set());
  const [documentsState, setDocumentsState] = useState({});
  const filterSignature = JSON.stringify({ typeDocumentId, columnFilters });

  useEffect(() => {
    if (highlightCasierId) {
      setExpandedCasiers((prev) => new Set([...prev, Number(highlightCasierId)]));
      requestAnimationFrame(() => {
        document.getElementById(`casier-${highlightCasierId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [highlightCasierId]);

  const onToggleCasier = useCallback((casierId) => {
    const id = Number(casierId);
    setExpandedCasiers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onLoadDocuments = useCallback(
    async (localiteId) => {
      const id = Number(localiteId);
      setDocumentsState((prev) => ({
        ...prev,
        [id]: { loading: true, documents: null, error: null },
      }));
      try {
        const res = await getDocumentsParLocalite(id, {
          limit: 200,
          statutQualite: statut,
          typeDocumentId: typeDocumentId || undefined,
          columnFilters,
        });
        setDocumentsState((prev) => ({
          ...prev,
          [id]: { loading: false, documents: res?.results || [], error: null },
        }));
      } catch (err) {
        setDocumentsState((prev) => ({
          ...prev,
          [id]: {
            loading: false,
            documents: null,
            error: err.message || "Impossible de charger les documents",
          },
        }));
      }
    },
    [statut, typeDocumentId, columnFilters]
  );

  useEffect(() => {
    setDocumentsState({});
    expandedCasiers.forEach((casierId) => {
      onLoadDocuments(casierId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  if (!casiers.length) {
    return (
      <p className="px-5 py-12 text-sm text-slate-400 text-center">
        Aucun casier avec des documents pour ce statut.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {casiers.map((casier) => (
        <CasierRow
          key={casier.id}
          casier={casier}
          statut={statut}
          statutConfig={statutConfig}
          expanded={expandedCasiers}
          onToggle={onToggleCasier}
          documentsState={documentsState}
          onLoadDocuments={onLoadDocuments}
          highlighted={Number(highlightCasierId) === Number(casier.id)}
        />
      ))}
    </div>
  );
}
