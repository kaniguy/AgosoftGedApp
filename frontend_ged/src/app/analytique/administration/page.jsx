"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAnalyticsAdministration } from "../../../services/analytique.service";
import { useAnalytiqueFilters } from "../../../hooks/useAnalytiqueFilters";
import RankingList from "../../../components/analytique/RankingList";
import { SimpleTrendChart } from "../../../components/analytique/SimpleTrendChart";
import {
  SectionCard,
  PageHeader,
  ErrorBanner,
  LoadingSkeleton,
  NoPermissionMessage,
} from "../../../components/analytique/AnalytiqueShared";
import { hasAnyPermission, PERMISSIONS } from "../../../utils/permissions";
import { downloadAnalytiqueReport, printAnalytiqueReport, buildFiltersLabel, formatMoisReport } from "../../../utils/printReport";

function SummaryBox({ total, actifs, connectes, nouveaux }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 shadow-lg">
      <p className="text-purple-200 text-sm font-medium">Vue d&apos;ensemble</p>
      <p className="text-3xl font-bold mt-1">{total ?? "—"} utilisateurs</p>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-purple-200">Comptes actifs</p>
          <p className="text-xl font-semibold">{actifs ?? "—"}</p>
        </div>
        <div>
          <p className="text-purple-200">Connectés (30 j)</p>
          <p className="text-xl font-semibold">{connectes ?? "—"}</p>
        </div>
        <div>
          <p className="text-purple-200">Nouveaux (30 j)</p>
          <p className="text-xl font-semibold">{nouveaux ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 border-slate-100 text-slate-800",
    green: "bg-emerald-50 border-emerald-100 text-emerald-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    red: "bg-rose-50 border-rose-100 text-rose-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
    </div>
  );
}

function GroupesSimpleTable({ data = [] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Aucun groupe configuré.</p>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-left font-semibold text-slate-600">Groupe</th>
            <th className="py-2 text-right font-semibold text-slate-600">Membres</th>
            <th className="py-2 text-right font-semibold text-slate-600">Localités</th>
            <th className="py-2 text-right font-semibold text-slate-600">Types doc.</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.groupe} className="border-b border-slate-50">
              <td className="py-2.5 font-medium text-slate-800">{row.groupe}</td>
              <td className="py-2.5 text-right tabular-nums">{row.membres}</td>
              <td className="py-2.5 text-right tabular-nums">{row.localites}</td>
              <td className="py-2.5 text-right tabular-nums">{row.types_documents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalytiqueAdministrationPage() {
  const canView = hasAnyPermission([
    PERMISSIONS.VIEW_USER,
    PERMISSIONS.VIEW_GROUP,
  ]);

  const { filters, setFilter, buildUrl } = useAnalytiqueFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getAnalyticsAdministration(filters);
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || "Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) {
    return (
      <NoPermissionMessage message="Vous n'avez pas la permission de consulter les statistiques utilisateurs." />
    );
  }

  const kpis = data?.kpis ?? {};

  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      downloadAnalytiqueReport({
      title: "Rapport analytique — Utilisateurs & accès",
      subtitle: "Statistiques utilisateurs, groupes et partage",
      filtersLabel: buildFiltersLabel(filters),
      sections: [
        {
          type: "kpis",
          title: "Vue d'ensemble",
          items: [
            { label: "Total utilisateurs", count: kpis.utilisateurs_total, taux: null },
            { label: "Comptes actifs", count: kpis.utilisateurs_actifs, taux: null },
            { label: "Connectés (30 j)", count: kpis.connexions_30j, taux: null },
            { label: "Nouveaux (30 j)", count: kpis.nouveaux_comptes_30j, taux: null },
            { label: "Comptes inactifs", count: kpis.utilisateurs_inactifs, taux: null },
            { label: "Jamais connectés", count: kpis.jamais_connectes, taux: null },
            { label: "Sans groupe", count: kpis.sans_groupe, taux: null },
          ],
        },
        {
          type: "chart",
          chart: "hbars",
          title: "Utilisateurs par groupe",
          items: (data.utilisateurs_par_groupe ?? []).map((g) => ({
            label: g.groupe,
            value: g.membres,
            color: "#8b5cf6",
          })),
        },
        {
          type: "chart",
          chart: "bars",
          title: "Nouveaux comptes créés",
          subtitle: "Évolution sur les 12 derniers mois",
          items: (data.evolution_comptes ?? []).map((m) => ({
            label: formatMoisReport(m.mois),
            value: m.count,
            color: "#6366f1",
          })),
        },
        {
          type: "table",
          title: "Périmètre des groupes",
          columns: ["Groupe", "Membres", "Localités", "Types doc."],
          rows: (data.couverture_groupes ?? []).map((g) => [
            g.groupe,
            g.membres,
            g.localites,
            g.types_documents,
          ]),
        },
        {
          type: "chart",
          chart: "hbars",
          title: "Liens de téléchargement",
          items: [
            { label: "Liens actifs", value: data.liens_telechargement?.actifs ?? 0, color: "#10b981" },
            { label: "Liens expirés", value: data.liens_telechargement?.expires ?? 0, color: "#94a3b8" },
            { label: "Créés (30 j)", value: data.liens_telechargement?.crees_30j ?? 0, color: "#f59e0b" },
            { label: "Documents partagés", value: data.liens_telechargement?.documents_partages ?? 0, color: "#6366f1" },
          ],
        },
      ],
    });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="print-header">
        <h1>Rapport analytique — Utilisateurs & accès</h1>
        <p>
          Généré le {new Date().toLocaleString("fr-FR")}
          {lastRefresh && ` · Données du ${lastRefresh.toLocaleString("fr-FR")}`}
        </p>
      </div>

      <PageHeader
        title="Utilisateurs & accès"
        subtitle="Combien d'utilisateurs, comment ils sont répartis et qui a accès à quoi"
        lastRefresh={lastRefresh}
        loading={loading || downloading}
        onRefresh={load}
        onDownload={data ? handleDownloadReport : undefined}
        downloadLabel={downloading ? "Génération…" : "Télécharger le rapport"}
        onPrint={() => printAnalytiqueReport("Utilisateurs")}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <label htmlFor="periode-admin" className="text-sm text-slate-600">
            Période :
          </label>
          <select
            id="periode-admin"
            value={filters.periode}
            onChange={(e) => setFilter("periode", e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="365">12 derniers mois</option>
            <option value="all">Toute la période</option>
          </select>
        </div>
        <Link
          href={buildUrl("/analytique/documents")}
          className="text-sm font-medium text-orange-700 hover:text-orange-900 hover:underline"
        >
          → Voir les statistiques documents
        </Link>
      </div>

      <ErrorBanner error={error} />

      {loading && !data ? (
        <LoadingSkeleton kpiCount={4} chartCount={2} />
      ) : (
        <div className="space-y-8">
          <SummaryBox
            total={kpis.utilisateurs_total}
            actifs={kpis.utilisateurs_actifs}
            connectes={kpis.connexions_30j}
            nouveaux={kpis.nouveaux_comptes_30j}
          />

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">État des comptes</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricTile
                label="Comptes actifs"
                value={kpis.utilisateurs_actifs}
                hint="Peuvent se connecter"
                tone="green"
              />
              <MetricTile
                label="Comptes inactifs"
                value={kpis.utilisateurs_inactifs}
                hint="Désactivés"
                tone="amber"
              />
              <MetricTile
                label="Jamais connectés"
                value={kpis.jamais_connectes}
                hint="Aucune connexion enregistrée"
                tone="red"
              />
              <MetricTile
                label="Sans groupe"
                value={kpis.sans_groupe}
                hint="Aucun rôle assigné"
                tone="red"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title="Utilisateurs par groupe"
              subtitle="Nombre de membres dans chaque groupe de sécurité"
            >
              <RankingList
                data={(data?.utilisateurs_par_groupe ?? []).map((g) => ({
                  utilisateur: g.groupe,
                  count: g.membres,
                }))}
                valueLabel="membres"
                colorClass="from-purple-500 to-purple-300"
                emptyMessage="Aucun groupe pour le moment"
              />
            </SectionCard>

            <SectionCard
              title="Nouveaux comptes créés"
              subtitle="Évolution sur les 12 derniers mois"
            >
              <SimpleTrendChart
                data={data?.evolution_comptes ?? []}
                color="#6366f1"
                valueLabel="Nouveaux comptes"
              />
            </SectionCard>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Accès & partage</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Périmètre des groupes"
                subtitle="Localités et types de documents autorisés par groupe"
              >
                <GroupesSimpleTable data={data?.couverture_groupes ?? []} />
              </SectionCard>

              <SectionCard
                title="Liens de téléchargement"
                subtitle="Documents partagés via lien externe"
              >
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Liens actifs"
                    value={kpis.liens_actifs}
                    tone="green"
                  />
                  <MetricTile
                    label="Liens expirés"
                    value={kpis.liens_expires}
                    tone="slate"
                  />
                  <MetricTile
                    label="Créés (30 j)"
                    value={kpis.liens_crees_30j}
                    tone="amber"
                  />
                  <MetricTile
                    label="Documents partagés"
                    value={kpis.documents_partages}
                    tone="slate"
                  />
                </div>
              </SectionCard>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
