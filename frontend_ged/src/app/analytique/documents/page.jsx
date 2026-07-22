"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAnalyticsDocuments, getAnalyticsDocumentsGeo, getAnalyticsMeta } from "../../../services/analytique.service";
import { useAnalytiqueFilters } from "../../../hooks/useAnalytiqueFilters";
import DocumentsParStatutChart from "../../../components/analytique/DocumentsParStatutChart";
import DocumentsParTypeChart from "../../../components/analytique/DocumentsParTypeChart";
import DocumentsGeoExplorer from "../../../components/analytique/DocumentsGeoExplorer";
import EvolutionStackedChart from "../../../components/analytique/EvolutionStackedChart";
import FunnelQCChart from "../../../components/analytique/FunnelQCChart";
import RankingList from "../../../components/analytique/RankingList";
import StatutKpiGrid from "../../../components/analytique/StatutKpiGrid";
import AnalytiqueFiltersBar from "../../../components/analytique/AnalytiqueFiltersBar";
import {
  SectionCard,
  PageHeader,
  ErrorBanner,
  LoadingSkeleton,
  NoPermissionMessage,
  RefreshOverlay,
} from "../../../components/analytique/AnalytiqueShared";
import { hasPermission, PERMISSIONS } from "../../../utils/permissions";
import { downloadAnalytiqueReport, printAnalytiqueReport, buildFiltersLabel, STATUT_COLORS, formatMoisReport } from "../../../utils/printReport";

export default function AnalytiqueDocumentsPage() {
  const canView = hasPermission(PERMISSIONS.VIEW_DOCUMENT_LOCALITE);
  const { filters, toggleFilter } = useAnalytiqueFilters();
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const hasLoadedOnce = useRef(false);
  const [meta, setMeta] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getAnalyticsMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  const handleDownloadReport = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      const statuts = data.kpis?.par_statut ?? data.documents_par_statut ?? [];
      let geoItems = [];
      let geoSubtitle = "Vue racine du plan géographique";
      try {
        const geo = await getAnalyticsDocumentsGeo(filters, "");
        geoSubtitle = `Niveau : ${geo?.niveau_label || "Racine"}`;
        const geoTotal = (geo?.items ?? []).reduce((sum, i) => sum + i.count, 0);
        geoItems = (geo?.items ?? []).map((i) => {
          const taux = geoTotal > 0 ? Math.round((i.count / geoTotal) * 1000) / 10 : 0;
          return { label: i.libelle, value: i.count, extra: `${taux} %` };
        });
      } catch {
        geoItems = [];
      }

      const funnelColors = ["#94a3b8", "#f59e0b", "#10b981", "#f43f5e"];

      downloadAnalytiqueReport({
        title: "Rapport analytique — Documents",
        subtitle: "Statistiques documentaires et répartition par statut qualité",
        filtersLabel: buildFiltersLabel(filters, {
          statuts: meta?.statuts,
          types: meta?.types_documents,
          localites: meta?.localites,
        }),
        sections: [
          {
            type: "kpis",
            title: "Synthèse par statut",
            items: [
              { label: "Total documents", count: data.kpis?.total_documents ?? 0, taux: 100 },
              ...statuts.map((s) => ({ label: s.label, count: s.count, taux: s.taux })),
            ],
          },
          {
            type: "chart",
            chart: "donut",
            title: "Répartition par statut",
            items: statuts.map((s) => ({
              label: s.label,
              value: s.count,
              color: STATUT_COLORS[s.statut] || "#6366f1",
            })),
          },
          {
            type: "chart",
            chart: "bars",
            title: "Entonnoir contrôle qualité",
            items: (data.funnel_qc ?? []).map((f, i) => ({
              label: f.etape,
              value: f.count,
              color: funnelColors[i % funnelColors.length],
            })),
          },
          {
            type: "chart",
            chart: "hbars",
            title: "Plan géographique",
            subtitle: geoSubtitle,
            items: geoItems,
          },
          {
            type: "chart",
            chart: "hbars",
            title: "Documents par type",
            items: (data.documents_par_type ?? []).map((t) => ({
              label: t.type,
              value: t.count,
            })),
          },
          {
            type: "chart",
            chart: "hbars",
            title: "Top créateurs",
            items: (data.top_createurs ?? []).map((u) => ({
              label: u.utilisateur,
              value: u.count,
            })),
          },
          {
            type: "chart",
            chart: "hbars",
            title: "Top validateurs",
            items: (data.top_validateurs ?? []).map((u) => ({
              label: u.utilisateur,
              value: u.count,
            })),
          },
          {
            type: "chart",
            chart: "stacked",
            title: "Évolution mensuelle",
            subtitle: "Documents créés par mois, ventilés par statut",
            series: [
              { key: "brouillon", label: "Brouillon", color: STATUT_COLORS.brouillon },
              { key: "en_attente", label: "En attente", color: STATUT_COLORS.en_attente },
              { key: "valide", label: "Validé", color: STATUT_COLORS.valide },
              { key: "rejete", label: "Rejeté", color: STATUT_COLORS.rejete },
            ],
            rows: (data.evolution_mensuelle ?? []).map((m) => ({
              label: formatMoisReport(m.mois),
              values: {
                brouillon: m.brouillon,
                en_attente: m.en_attente,
                valide: m.valide,
                rejete: m.rejete,
              },
            })),
          },
        ],
      });
    } finally {
      setDownloading(false);
    }
  };

  const load = useCallback(async () => {
    if (!canView) {
      setInitialLoading(false);
      return;
    }
    try {
      if (hasLoadedOnce.current) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }
      setError(null);
      const result = await getAnalyticsDocuments(filters);
      setData(result);
      setLastRefresh(new Date());
      hasLoadedOnce.current = true;
    } catch (err) {
      setError(err.message || "Impossible de charger les statistiques documentaires.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) {
    return (
      <NoPermissionMessage message="Vous n'avez pas la permission de consulter les statistiques documentaires." />
    );
  }

  const parStatut = data?.kpis?.par_statut ?? data?.documents_par_statut ?? [];
  const total = data?.kpis?.total_documents ?? 0;

  return (
    <div>
      <div className="print-header">
        <h1>Rapport analytique — Documents</h1>
        <p>
          Généré le {new Date().toLocaleString("fr-FR")}
          {lastRefresh && ` · Données du ${lastRefresh.toLocaleString("fr-FR")}`}
        </p>
      </div>

      <PageHeader
        title="Analytique — Documents"
        subtitle="Répartition par statut qualité et exploration du plan géographique"
        lastRefresh={lastRefresh}
        loading={refreshing || downloading}
        onRefresh={load}
        onDownload={data ? handleDownloadReport : undefined}
        downloadLabel={downloading ? "Génération…" : "Télécharger le rapport"}
        onPrint={() => printAnalytiqueReport("Documents")}
      />

      <div className="no-print">
        <AnalytiqueFiltersBar showLocalite={false} />
      </div>

      <ErrorBanner error={error} />

      {initialLoading && !data ? (
        <LoadingSkeleton kpiCount={5} chartCount={4} />
      ) : (
        <RefreshOverlay show={refreshing}>
          <div className="space-y-6">
            <StatutKpiGrid
              total={total}
              parStatut={parStatut}
              activeStatut={filters.statut}
              onStatutClick={(statut) => toggleFilter("statut", statut)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Répartition par statut"
                subtitle="Cliquez sur un statut pour filtrer le dashboard"
              >
                <DocumentsParStatutChart
                  data={parStatut}
                  activeStatut={filters.statut}
                  onStatutClick={(statut) => toggleFilter("statut", statut)}
                />
              </SectionCard>

              <SectionCard
                title="Entonnoir contrôle qualité"
                subtitle="Volume à chaque étape du parcours documentaire"
              >
                <FunnelQCChart
                  data={data?.funnel_qc ?? []}
                  activeStatut={filters.statut}
                  onStatutClick={(statut) => toggleFilter("statut", statut)}
                />
              </SectionCard>
            </div>

            <SectionCard
              title="Plan géographique"
              subtitle="Naviguez niveau par niveau dans la structure géographique"
            >
              <DocumentsGeoExplorer />
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Documents par type"
                subtitle="Cliquez sur un type pour filtrer"
              >
                <DocumentsParTypeChart
                  data={data?.documents_par_type ?? []}
                  activeTypeId={filters.type_document}
                  onTypeClick={(typeId) => toggleFilter("type_document", typeId)}
                />
              </SectionCard>

              <SectionCard
                title="Évolution mensuelle"
                subtitle="Documents créés par mois, ventilés par statut"
              >
                <EvolutionStackedChart
                  data={data?.evolution_mensuelle ?? []}
                  activeStatut={filters.statut}
                />
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Top créateurs" subtitle="Documents créés sur la période">
                <RankingList
                  data={data?.top_createurs ?? []}
                  valueLabel="docs"
                  colorClass="from-orange-500 to-orange-300"
                />
              </SectionCard>

              <SectionCard title="Top validateurs" subtitle="Documents validés sur la période">
                <RankingList
                  data={data?.top_validateurs ?? []}
                  valueLabel="validations"
                  colorClass="from-emerald-500 to-emerald-300"
                />
              </SectionCard>
            </div>
          </div>
        </RefreshOverlay>
      )}
    </div>
  );
}
