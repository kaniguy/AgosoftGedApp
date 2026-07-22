"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_PAGE_SIZE,
  getDocuments,
} from "../../services/documentLocalite.service";
import {
  buildGeoColumns,
  getCheminEntry,
  getLeafLocaliteLabel,
} from "../../utils/documentGeoColumns";
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

export default function ControleQualiteListeDetaillee({
  statut,
  structures = [],
  typeDocumentId = "",
  columnFilters = {},
}) {
  const router = useRouter();
  const geoColumns = useMemo(() => buildGeoColumns(structures), [structures]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const filterSignature = JSON.stringify({ statut, typeDocumentId, columnFilters });

  const loadDocuments = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError("");
      try {
        const res = await getDocuments({
          statutQualite: statut,
          typeDocumentId: typeDocumentId || undefined,
          columnFilters,
          offset,
          limit: DOCUMENT_PAGE_SIZE,
        });
        setDocuments(res.results);
        setTotal(res.total);
        setHasMore(res.has_more);
        setPageOffset(res.offset);
      } catch (err) {
        setError(err.message || "Impossible de charger les documents");
        setDocuments([]);
        setTotal(0);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [statut, typeDocumentId, columnFilters]
  );

  useEffect(() => {
    loadDocuments(0);
  }, [filterSignature, loadDocuments]);

  const goToDocument = (doc) => {
    if (!canOpenDocumentQc(statut)) return;
    router.push(`/controle_qualite/validation/${doc.localite}/${doc.id}?statut=${statut}`);
  };

  const currentPage = Math.floor(pageOffset / DOCUMENT_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / DOCUMENT_PAGE_SIZE));
  const btnPrimary =
    "px-3 py-1.5 text-xs font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg disabled:opacity-50";
  const btnSecondary =
    "px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 rounded-lg";

  if (loading && !documents.length) {
    return <p className="px-5 py-12 text-sm text-slate-400 text-center">Chargement des documents…</p>;
  }

  if (error) {
    return <p className="px-5 py-12 text-sm text-red-600 text-center">{error}</p>;
  }

  if (!documents.length) {
    return (
      <p className="px-5 py-12 text-sm text-slate-400 text-center">
        Aucun document ne correspond aux filtres.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="overflow-x-auto">
        <table className="min-w-full w-max text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-amber-900 bg-gradient-to-r from-amber-100 to-yellow-100">
              {geoColumns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 font-semibold whitespace-nowrap">
                  {col.label}
                </th>
              ))}
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
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-yellow-50/60 bg-white">
                {geoColumns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 align-top text-slate-800">
                    {col.key.startsWith("geo_") && (
                      <span className="font-medium">
                        {getCheminEntry(doc, col.niveauOrdre)?.libelle || "—"}
                      </span>
                    )}
                    {col.key === "localite" && (
                      <span className="font-medium">{getLeafLocaliteLabel(doc)}</span>
                    )}
                  </td>
                ))}
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
                    onClick={() => goToDocument(doc)}
                    disabled={!canOpenDocumentQc(statut)}
                    className={statut === STATUT_VALIDE ? btnSecondary : btnPrimary}
                  >
                    {getQcActionLabel(statut)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-slate-100 text-sm bg-slate-50/50">
          <span className="text-slate-600">
            Page {currentPage} / {totalPages} — {total} document{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDocuments(Math.max(0, pageOffset - DOCUMENT_PAGE_SIZE))}
              disabled={pageOffset <= 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => loadDocuments(pageOffset + DOCUMENT_PAGE_SIZE)}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
