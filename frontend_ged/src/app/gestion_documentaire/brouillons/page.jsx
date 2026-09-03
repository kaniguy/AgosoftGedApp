// Liste des brouillons de rattachement (tableau paginé)
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteRattachementDraft,
  listRattachementDrafts,
  RATTACHEMENT_DRAFTS_UPDATED,
} from "../../../utils/rattachementDraftStore";
import { getModelCrudPermissions, MODELS } from "../../../utils/permissions";

const PAGE_SIZE = 15;

function formatDraftDate(timestamp) {
  if (!timestamp) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return "—";
  }
}

export default function BrouillonsPage() {
  const router = useRouter();
  const { canView, canAdd, canDelete } = getModelCrudPermissions(MODELS.DOCUMENT_LOCALITE);

  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);

  const loadDrafts = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    setError("");
    try {
      const list = await listRattachementDrafts();
      setDrafts(list);
    } catch (err) {
      setError(err.message || "Impossible de charger les brouillons.");
      setDrafts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      router.replace("/gestion_documentaire/plan_geographique");
      return;
    }
    loadDrafts();
  }, [canView, router, loadDrafts]);

  useEffect(() => {
    const onUpdate = () => loadDrafts({ silent: true });
    window.addEventListener(RATTACHEMENT_DRAFTS_UPDATED, onUpdate);
    return () => window.removeEventListener(RATTACHEMENT_DRAFTS_UPDATED, onUpdate);
  }, [loadDrafts]);

  const total = drafts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageDrafts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return drafts.slice(start, start + PAGE_SIZE);
  }, [drafts, page]);

  const handleDelete = async (draftId) => {
    if (!window.confirm("Supprimer ce brouillon ? Cette action est irréversible.")) return;
    setDeletingId(draftId);
    try {
      await deleteRattachementDraft(draftId);
      const nextTotal = drafts.filter((d) => d.id !== draftId).length;
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (page > nextTotalPages) setPage(nextTotalPages);
      await loadDrafts({ silent: true });
    } catch (err) {
      setError(err.message || "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] -mx-2 min-w-0 max-w-full">
      <div className="mb-5">
        <nav className="text-sm flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-slate-500 hover:text-emerald-600 transition cursor-pointer"
          >
            Accueil
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => router.push("/gestion_documentaire/plan_geographique")}
            className="text-slate-500 hover:text-emerald-600 transition cursor-pointer"
          >
            Gestion documentaire
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-semibold">Liste des brouillons</span>
        </nav>
      </div>

      <div className="rounded-2xl shadow-xl border border-emerald-100/80 overflow-hidden bg-white flex flex-col min-h-[calc(100vh-10rem)]">
        <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white shrink-0">
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Brouillons de rattachement</h1>
              <p className="text-emerald-100 mt-1.5 text-sm max-w-2xl">
                Lots non soumis à validation — visibles par tous les utilisateurs autorisés sur la
                localité.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-bold shadow-md">
              {total} brouillon{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col p-5 sm:p-6">
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-emerald-100 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
              </div>
            ) : total === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-slate-700 font-medium">Aucun brouillon en cours</p>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                  Les lots importés sur le plan de classement sont enregistrés automatiquement pendant
                  votre saisie.
                </p>
                <Link
                  href="/gestion_documentaire/plan_geographique"
                  className="inline-block mt-6 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                >
                  Ouvrir le plan de classement
                </Link>
              </div>
            ) : (
              <table className="w-full min-w-[880px] text-sm text-left">
                <thead className="sticky top-0 z-10 bg-emerald-50/95 backdrop-blur border-b border-emerald-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap">
                      Localité
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap">
                      Emplacement
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap">
                      Type de document
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap text-center">
                      Documents
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap">
                      Dernière modification
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap">
                      Modifié par
                    </th>
                    <th className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {pageDrafts.map((draft) => (
                    <tr key={draft.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {draft.localiteLibelle || `Localité #${draft.localiteId}`}
                      </td>
                      <td
                        className="px-4 py-3 text-slate-600 max-w-[240px] truncate"
                        title={draft.localiteCheminStr || "—"}
                      >
                        {draft.localiteCheminStr || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {draft.typeLibelle || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {draft.pendingCount}
                          {draft.totalCount > draft.pendingCount
                            ? ` / ${draft.totalCount}`
                            : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDraftDate(draft.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {draft.utilisateurNom || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canAdd ? (
                            <Link
                              href={`/gestion_documentaire/plan_geographique/${draft.localiteId}/rattacher?draft=${draft.id}`}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                            >
                              Poursuivre
                            </Link>
                          ) : (
                            <span className="px-3 py-1.5 text-xs text-slate-400">Consultation seule</span>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === draft.id}
                              onClick={() => handleDelete(draft.id)}
                              className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                            >
                              {deletingId === draft.id ? "Suppression…" : "Supprimer"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-1 text-sm shrink-0">
              <span className="text-slate-600">
                Page {page} / {totalPages} — {total} brouillon{total !== 1 ? "s" : ""}
                {totalPages > 1 && (
                  <span className="text-slate-400">
                    {" "}
                    (lignes {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)})
                  </span>
                )}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
