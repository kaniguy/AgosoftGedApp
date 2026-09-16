"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deleteLienTelechargement,
  getLiensTelechargement,
  toggleLienTelechargement,
} from "../../../services/liensTelechargement.service";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import { copyToClipboard } from "../../../utils/copyToClipboard";
import { hasPermission, PERMISSIONS, useCrudPermissions, MODELS } from "../../../utils/permissions";
import EmptyListState from "../../../components/ui/EmptyListState";

const ITEMS_PER_PAGE = 10;

const STATUS_ORDER = [
  "Actif",
  "Partiellement indisponible",
  "Expiré",
  "Désactivé",
  "Utilisé (usage unique)",
  "Documents indisponibles",
];

const STATUS_STYLES = {
  Actif: "bg-green-100 text-green-700",
  Expiré: "bg-amber-100 text-amber-800",
  Désactivé: "bg-gray-100 text-gray-600",
  "Utilisé (usage unique)": "bg-slate-100 text-slate-700",
  "Documents indisponibles": "bg-red-100 text-red-700",
  "Partiellement indisponible": "bg-orange-100 text-orange-800",
};

function statusRank(label) {
  const idx = STATUS_ORDER.indexOf(label);
  return idx === -1 ? STATUS_ORDER.length : idx;
}

function StatusBadge({ link }) {
  const tone = STATUS_STYLES[link.status_label] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${tone}`}>
      {link.status_label}
    </span>
  );
}

function documentSearchText(link) {
  const docs = link.documents || [];
  return docs
    .map((doc) =>
      [doc.type_document_libelle, doc.type_document_code, doc.fichier_nom, doc.localite_libelle]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

function DocumentsSummary({ link, onOpen }) {
  const available = link.documents_available_count ?? link.document_count ?? 0;
  const total = link.document_count ?? 0;
  const missing = link.documents_missing_count ?? 0;
  const firstName =
    (link.documents || []).find((d) => d.fichier_nom)?.fichier_nom ||
    (link.documents || []).find((d) => d.type_document_libelle)?.type_document_libelle ||
    "";

  return (
    <button
      type="button"
      onClick={() => onOpen(link)}
      className="text-left hover:text-purple-700"
      title="Voir le détail des documents"
    >
      <div className="font-medium text-gray-800 tabular-nums">
        {available}/{total} disponible{total > 1 ? "s" : ""}
      </div>
      {firstName && (
        <div className="text-xs text-gray-500 truncate max-w-[16rem]" title={firstName}>
          {firstName}
          {total > 1 ? ` (+${total - 1})` : ""}
        </div>
      )}
      {missing > 0 && (
        <div className="text-[11px] text-orange-700">
          {missing} indisponible{missing > 1 ? "s" : ""}
        </div>
      )}
    </button>
  );
}

export default function LiensTelechargementPage() {
  const searchParams = useSearchParams();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("statut") || "");
  const recentDays = Number(searchParams.get("recent") || 0) || 0;
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [detailLink, setDetailLink] = useState(null);

  const canManage = hasPermission(PERMISSIONS.VIEW_LIEN_TELECHARGEMENT);
  const { canChange, canDelete } = useCrudPermissions(MODELS.LIEN_TELECHARGEMENT);

  const showNotif = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getLiensTelechargement();
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      showNotif(err.message, "error");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, showNotif]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatusFilter(searchParams.get("statut") || "");
  }, [searchParams]);

  const statusCounts = useMemo(() => {
    const counts = {};
    links.forEach((link) => {
      const label = link.status_label || "Inconnu";
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [links]);

  const statusOptions = useMemo(() => {
    const extra = Object.keys(statusCounts).filter((label) => !STATUS_ORDER.includes(label));
    return [...STATUS_ORDER, ...extra.sort((a, b) => a.localeCompare(b, "fr"))].filter(
      (label) => statusCounts[label]
    );
  }, [statusCounts]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const next = links.filter((link) => {
      if (statusFilter && link.status_label !== statusFilter) return false;
      if (recentDays > 0) {
        const created = new Date(link.created_at || 0).getTime();
        if (created < Date.now() - recentDays * 24 * 60 * 60 * 1000) return false;
      }
      if (!q) return true;
      const haystack = [
        link.created_by_label,
        link.created_by_username,
        link.status_label,
        link.download_url,
        documentSearchText(link),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    next.sort((a, b) => {
      const rankDiff = statusRank(a.status_label) - statusRank(b.status_label);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return next;
  }, [links, searchQuery, statusFilter, recentDays]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, safePage]);

  const pageRows = useMemo(() => {
    const rows = [];
    let lastStatus = null;
    pageItems.forEach((link, index) => {
      const showGroup = !statusFilter && link.status_label !== lastStatus;
      if (showGroup) {
        rows.push({ type: "group", status: link.status_label, key: `group-${link.status_label}-${index}` });
        lastStatus = link.status_label;
      }
      rows.push({ type: "link", link, index, key: `link-${link.id}` });
    });
    return rows;
  }, [pageItems, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const startIndex = totalCount === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(safePage * ITEMS_PER_PAGE, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handleToggle = async (link) => {
    if (link.is_expired) {
      showNotif("Un lien expiré ne peut pas être réactivé.", "error");
      return;
    }
    setTogglingId(link.id);
    try {
      await toggleLienTelechargement(link.id, !link.is_active);
      showNotif(link.is_active ? "Lien désactivé." : "Lien réactivé.");
      await load();
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (link) => {
    const confirmed = window.confirm(
      "Supprimer définitivement ce lien ? Cette action est irréversible."
    );
    if (!confirmed) return;

    setDeletingId(link.id);
    try {
      await deleteLienTelechargement(link.id);
      showNotif("Lien supprimé.");
      await load();
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (link) => {
    try {
      await copyToClipboard(link.download_url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
      showNotif("Lien copié dans le presse-papiers.");
    } catch {
      showNotif("Copie impossible. Sélectionnez le lien et utilisez Ctrl+C.", "error");
    }
  };

  if (!canManage) {
    return (
      <div className="text-center py-12 text-gray-500">
        Vous n&apos;avez pas la permission de consulter les liens de téléchargement.
      </div>
    );
  }

  return (
    <div>
      {notification && (
        <div
          className={`fixed top-20 right-5 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${
            notification.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Liens de téléchargement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Liens temporaires générés depuis la recherche avancée
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
          <h2 className="font-semibold text-gray-800">
            {totalCount === 0
              ? "Liste (0)"
              : `Affichage ${startIndex} à ${endIndex} sur ${totalCount}`}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg w-64 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                statusFilter === ""
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Tous ({links.length})
            </button>
            {statusOptions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setStatusFilter(label);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  statusFilter === label
                    ? `${STATUS_STYLES[label] || "bg-gray-100 text-gray-700"} border-current`
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label} ({statusCounts[label]})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement des liens…</div>
        ) : totalCount === 0 ? (
          <EmptyListState
            icon="link"
            tone="purple"
            title={
              searchQuery || statusFilter || recentDays
                ? "Aucun lien ne correspond"
                : "Aucun lien généré"
            }
            description={
              searchQuery || statusFilter || recentDays
                ? "Aucun lien de téléchargement ne correspond aux filtres."
                : "Les liens partagés apparaîtront ici dès qu’ils seront créés."
            }
          />
        ) : (
          <>
            <div className="overflow-auto max-h-[500px] border border-gray-300 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-800 text-white sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-700 px-4 py-3 text-left w-[60px]">N°</th>
                    <th className="border border-gray-700 px-4 py-3 text-left">Généré le</th>
                    <th className="border border-gray-700 px-4 py-3 text-left">Utilisateur</th>
                    <th className="border border-gray-700 px-4 py-3 text-left">Documents</th>
                    <th className="border border-gray-700 px-4 py-3 text-left">Validité</th>
                    <th className="border border-gray-700 px-4 py-3 text-left">Expire le</th>
                    <th className="border border-gray-700 px-4 py-3 text-center">Statut</th>
                    <th className="border border-gray-700 px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pageRows.map((row) =>
                    row.type === "group" ? (
                      <tr key={row.key} className="bg-gray-50">
                        <td
                          colSpan={8}
                          className="border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600"
                        >
                          {row.status}
                          {statusCounts[row.status] ? ` (${statusCounts[row.status]})` : ""}
                        </td>
                      </tr>
                    ) : (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3 text-gray-700">
                        {startIndex + row.index}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDisplayDateTime(row.link.created_at)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="font-medium text-gray-800">{row.link.created_by_label}</div>
                        <div className="text-xs text-gray-500">{row.link.created_by_username}</div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <DocumentsSummary link={row.link} onOpen={setDetailLink} />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-700 whitespace-nowrap">
                        {row.link.validity_hours} h
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDisplayDateTime(row.link.expires_at)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <StatusBadge link={row.link} />
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(row.link)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-800 text-white text-xs rounded"
                            title={row.link.download_url}
                          >
                            {copiedId === row.link.id ? "Copié !" : "Copier"}
                          </button>
                          {canChange && (
                            <button
                              type="button"
                              disabled={togglingId === row.link.id || row.link.is_expired}
                              onClick={() => handleToggle(row.link)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded disabled:opacity-40"
                            >
                              {togglingId === row.link.id
                                ? "…"
                                : row.link.is_active
                                  ? "Désactiver"
                                  : "Réactiver"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === row.link.id}
                              onClick={() => handleDelete(row.link)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-40"
                            >
                              {deletingId === row.link.id ? "…" : "Supprimer"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="mt-4">
                <ul className="flex justify-center gap-2">
                  <li>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={safePage === 1}
                      className={`px-3 py-1 border rounded-lg transition ${
                        safePage === 1
                          ? "border-gray-300 text-gray-400 cursor-not-allowed"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Précédent
                    </button>
                  </li>
                  {getPageNumbers().map((num) => (
                    <li key={num}>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(num)}
                        className={`px-3 py-1 border rounded-lg transition ${
                          safePage === num
                            ? "bg-purple-600 text-white border-purple-600"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {num}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={safePage === totalPages}
                      className={`px-3 py-1 border rounded-lg transition ${
                        safePage === totalPages
                          ? "border-gray-300 text-gray-400 cursor-not-allowed"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Suivant
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        )}
      </div>

      {detailLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="bg-purple-600 text-white px-6 py-3 flex justify-between items-center">
              <h3 className="font-semibold">Documents du lien</h3>
              <button type="button" onClick={() => setDetailLink(null)} className="text-xl leading-none">
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-2">
              {(detailLink.documents || []).length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun détail document</p>
              ) : (
                (detailLink.documents || []).map((doc) => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    {doc.missing ? (
                      <p className="text-red-600 italic">Document #{doc.id} — supprimé ou introuvable</p>
                    ) : (
                      <>
                        <div className="font-medium text-gray-800">
                          {doc.type_document_code
                            ? `${doc.type_document_libelle} (${doc.type_document_code})`
                            : doc.type_document_libelle || "Type inconnu"}
                          {doc.format && doc.format !== "—" ? (
                            <span className="ml-2 text-xs font-semibold text-purple-700">{doc.format}</span>
                          ) : null}
                          {!doc.is_available && (
                            <span className="ml-2 text-xs text-orange-700">Fichier absent</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Site :{" "}
                          {doc.localite_code
                            ? `${doc.localite_libelle} (${doc.localite_code})`
                            : doc.localite_libelle || "—"}
                        </p>
                        {doc.fichier_nom && (
                          <p className="text-xs text-gray-500 truncate" title={doc.fichier_nom}>
                            Fichier : {doc.fichier_nom}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
