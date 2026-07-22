"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteLienTelechargement,
  getLiensTelechargement,
  toggleLienTelechargement,
} from "../../../services/liensTelechargement.service";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import { hasPermission, PERMISSIONS, useCrudPermissions, MODELS } from "../../../utils/permissions";

const STATUS_STYLES = {
  Actif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Expiré: "bg-amber-50 text-amber-800 border-amber-200",
  Désactivé: "bg-slate-100 text-slate-600 border-slate-200",
  "Documents indisponibles": "bg-red-50 text-red-700 border-red-200",
  "Partiellement indisponible": "bg-orange-50 text-orange-800 border-orange-200",
};

const FORMAT_STYLES = {
  PDF: "bg-rose-50 text-rose-700 border-rose-200",
  JPEG: "bg-sky-50 text-sky-700 border-sky-200",
  PNG: "bg-indigo-50 text-indigo-700 border-indigo-200",
  WEBP: "bg-violet-50 text-violet-700 border-violet-200",
  GIF: "bg-pink-50 text-pink-700 border-pink-200",
};

function StatusBadge({ link }) {
  const tone = STATUS_STYLES[link.status_label] || "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tone}`}>
      {link.status_label}
    </span>
  );
}

function DocumentLine({ doc }) {
  if (doc.missing) {
    return (
      <li className="text-[11px] text-red-600 italic">
        Document #{doc.id} — supprimé ou introuvable
      </li>
    );
  }

  const typeLabel = doc.type_document_code
    ? `${doc.type_document_libelle} (${doc.type_document_code})`
    : doc.type_document_libelle || "Type inconnu";
  const localite = doc.localite_code
    ? `${doc.localite_libelle} (${doc.localite_code})`
    : doc.localite_libelle || "—";
  const formatStyle = FORMAT_STYLES[doc.format] || "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-800">{typeLabel}</span>
        {doc.format && doc.format !== "—" && (
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${formatStyle}`}>
            {doc.format}
          </span>
        )}
        {!doc.is_available && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
            Fichier absent
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">Site :</span> {localite}
      </p>
      {doc.fichier_nom && (
        <p className="text-[11px] text-slate-500 truncate max-w-[18rem]" title={doc.fichier_nom}>
          <span className="font-medium text-slate-600">Fichier :</span> {doc.fichier_nom}
        </p>
      )}
      {doc.date_creation && (
        <p className="text-[10px] text-slate-400">
          Enregistré le {formatDisplayDateTime(doc.date_creation)}
        </p>
      )}
    </li>
  );
}

function DocumentsCell({ link }) {
  const [expanded, setExpanded] = useState(false);
  const available = link.documents_available_count ?? link.document_count;
  const total = link.document_count ?? 0;
  const missing = link.documents_missing_count ?? 0;
  const documents = link.documents || [];
  const visibleLimit = 2;
  const hasMore = documents.length > visibleLimit;
  const visibleDocs = expanded ? documents : documents.slice(0, visibleLimit);

  return (
    <div className="min-w-[14rem] max-w-[22rem]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-slate-800 tabular-nums">
          {available}/{total} disponible{total > 1 ? "s" : ""}
        </span>
        {missing > 0 && (
          <span
            className="text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded"
            title="Document supprimé ou fichier absent"
          >
            {missing} indisponible{missing > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {documents.length > 0 ? (
        <>
          <ul className="space-y-1.5">
            {visibleDocs.map((doc) => (
              <DocumentLine key={doc.id} doc={doc} />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 text-[11px] font-medium text-purple-700 hover:text-purple-900"
            >
              {expanded ? "Réduire" : `Voir les ${documents.length - visibleLimit} autre(s)`}
            </button>
          )}
        </>
      ) : (
        <p className="text-[11px] text-slate-400 italic">Aucun détail document</p>
      )}
    </div>
  );
}

export default function LiensTelechargementPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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
      await navigator.clipboard.writeText(link.download_url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
      showNotif("Lien copié dans le presse-papiers.");
    } catch {
      showNotif("Copie impossible.", "error");
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center text-slate-500">
        Vous n&apos;avez pas la permission de consulter les liens de téléchargement.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[90rem] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Liens de téléchargement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Liens temporaires générés depuis la recherche avancée — activation, désactivation et suivi.
        </p>
      </div>

      {notification && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            notification.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Chargement…</div>
        ) : links.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Aucun lien généré pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-gradient-to-r from-purple-600 to-violet-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Généré le</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase min-w-[16rem]">
                    Documents
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Validité</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Expire le</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDisplayDateTime(link.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{link.created_by_label}</div>
                      <div className="text-xs text-slate-400">{link.created_by_username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <DocumentsCell link={link} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{link.validity_hours} h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDisplayDateTime(link.expires_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge link={link} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(link)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title={link.download_url}
                        >
                          {copiedId === link.id ? "Copié !" : "Copier"}
                        </button>
                        {canChange && (
                          <button
                            type="button"
                            disabled={togglingId === link.id || link.is_expired}
                            onClick={() => handleToggle(link)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 text-purple-800 hover:bg-purple-50 disabled:opacity-40"
                          >
                            {togglingId === link.id
                              ? "…"
                              : link.is_active
                                ? "Désactiver"
                                : "Réactiver"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === link.id}
                            onClick={() => handleDelete(link)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            {deletingId === link.id ? "…" : "Supprimer"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
