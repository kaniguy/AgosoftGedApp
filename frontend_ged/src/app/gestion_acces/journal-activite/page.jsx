"use client";

import { useCallback, useEffect, useState } from "react";
import {
  downloadJournalActiviteExcel,
  getJournalActivite,
} from "../../../services/journalActivite.service";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import { hasPermission, PERMISSIONS } from "../../../utils/permissions";
import EmptyListState from "../../../components/ui/EmptyListState";

const ACTION_OPTIONS = [
  { value: "", label: "Toutes les actions" },
  { value: "connexion", label: "Connexion" },
  { value: "deconnexion", label: "Déconnexion" },
  { value: "connexion_echouee", label: "Connexion échouée" },
  { value: "creation", label: "Création" },
  { value: "modification", label: "Modification" },
  { value: "suppression", label: "Suppression" },
  { value: "soumettre_qc", label: "Soumettre QC" },
  { value: "valider_qc", label: "Valider QC" },
  { value: "rejeter_qc", label: "Rejeter QC" },
  { value: "annoter", label: "Annotation" },
  { value: "tamponner", label: "Tampon" },
  { value: "signer", label: "Signature" },
  { value: "commenter", label: "Note" },
  { value: "telecharger", label: "Téléchargement" },
  { value: "envoyer_email", label: "Envoi e-mail" },
  { value: "exporter", label: "Export" },
  { value: "restaurer", label: "Restauration" },
  { value: "reinitialiser", label: "Réinitialisation" },
  { value: "autre", label: "Autre" },
];

const CATEGORIE_OPTIONS = [
  { value: "", label: "Toutes les catégories" },
  { value: "authentification", label: "Authentification" },
  { value: "utilisateurs", label: "Utilisateurs" },
  { value: "groupes", label: "Groupes" },
  { value: "documents", label: "Documents" },
  { value: "parametrage", label: "Paramétrage" },
  { value: "liens", label: "Liens de téléchargement" },
  { value: "entreprise", label: "Entreprise" },
  { value: "configuration_email", label: "Configuration SMTP-mail" },
  { value: "journal", label: "Journal d'activité" },
  { value: "base_donnees", label: "Base de données" },
  { value: "autre", label: "Autre" },
];

const ACTION_STYLES = {
  connexion: "bg-emerald-50 text-emerald-700 border-emerald-200",
  deconnexion: "bg-slate-100 text-slate-700 border-slate-200",
  connexion_echouee: "bg-red-50 text-red-700 border-red-200",
  creation: "bg-sky-50 text-sky-700 border-sky-200",
  modification: "bg-amber-50 text-amber-800 border-amber-200",
  suppression: "bg-rose-50 text-rose-700 border-rose-200",
  soumettre_qc: "bg-indigo-50 text-indigo-700 border-indigo-200",
  valider_qc: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejeter_qc: "bg-orange-50 text-orange-800 border-orange-200",
  annoter: "bg-yellow-50 text-yellow-800 border-yellow-200",
  tamponner: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  signer: "bg-cyan-50 text-cyan-800 border-cyan-200",
  commenter: "bg-teal-50 text-teal-800 border-teal-200",
  telecharger: "bg-blue-50 text-blue-700 border-blue-200",
  envoyer_email: "bg-lime-50 text-lime-800 border-lime-200",
  exporter: "bg-indigo-50 text-indigo-800 border-indigo-200",
  restaurer: "bg-amber-50 text-amber-800 border-amber-200",
  reinitialiser: "bg-rose-50 text-rose-800 border-rose-200",
  autre: "bg-violet-50 text-violet-700 border-violet-200",
};

function ActionBadge({ action, label }) {
  const tone = ACTION_STYLES[action] || ACTION_STYLES.autre;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tone}`}>
      {label || action}
    </span>
  );
}

function NomPrenomCell({ row }) {
  const fullName = [row.nom, row.prenom].filter(Boolean).join(" ").trim();
  return (
    <div className="font-medium text-gray-800 whitespace-nowrap">
      {fullName || "—"}
    </div>
  );
}

function IdentifiantsCell({ row }) {
  const username = row.nom_utilisateur || "";
  const email = row.email || "";

  return (
    <div className="min-w-[9rem]">
      <div className="font-medium text-gray-800">{username || "—"}</div>
      {email && <div className="text-[11px] text-gray-400 mt-0.5 break-all">{email}</div>}
    </div>
  );
}

export default function JournalActivitePage() {
  const canView = hasPermission(PERMISSIONS.VIEW_JOURNAL_ACTIVITE);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [categorie, setCategorie] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;

  const filterParams = {
    search,
    action,
    categorie,
    date_debut: dateDebut,
    date_fin: dateFin,
  };

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getJournalActivite({
        ...filterParams,
        page,
        page_size: pageSize,
      });

      if (Array.isArray(data)) {
        setRows(data);
        setTotalCount(data.length);
        setTotalPages(1);
      } else {
        setRows(Array.isArray(data.results) ? data.results : []);
        setTotalCount(data.count ?? 0);
        const count = data.count ?? 0;
        setTotalPages(Math.max(1, Math.ceil(count / pageSize)));
      }
    } catch (err) {
      setError(err.message || "Impossible de charger le journal.");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, search, action, categorie, dateDebut, dateFin, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, action, categorie, dateDebut, dateFin]);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      setError(null);
      await downloadJournalActiviteExcel(filterParams);
    } catch (err) {
      setError(err.message || "Impossible d'exporter le journal.");
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
        Vous n&apos;avez pas la permission de consulter le journal d&apos;activité.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Journal d&apos;activité</h1>
          <p className="text-sm text-gray-500 mt-1">
            Qui a fait quoi, à quelle heure — connexions, déconnexions et actions métier
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {exporting ? "Export…" : "Télécharger Excel"}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-3 items-end mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recherche</label>
            <input
              type="text"
              placeholder="Nom, email, description, IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-64 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Catégorie</label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {CATEGORIE_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Du</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Au</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Actualiser
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Événements ({totalCount})</h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Préc.
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Suiv.
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : rows.length === 0 ? (
          <EmptyListState
            icon="inbox"
            tone="purple"
            title="Aucun événement"
            description="Aucun événement n’est enregistré pour ces filtres."
          />
        ) : (
          <div className="overflow-auto max-h-[560px] border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Date / heure</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nom et prénom</th>
                  <th className="px-4 py-3 text-left">Identifiant</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 tabular-nums">
                      {formatDisplayDateTime(row.date_creation, { withSeconds: true })}
                    </td>
                    <td className="px-4 py-3">
                      <NomPrenomCell row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <IdentifiantsCell row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={row.action} label={row.action_label} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.categorie_label || row.categorie}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md">
                      <p className="leading-snug">{row.description}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {row.adresse_ip || "—"}
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
