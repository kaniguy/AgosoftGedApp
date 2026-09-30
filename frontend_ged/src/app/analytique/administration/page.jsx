"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getAnalyticsAdministration } from "../../../services/analytique.service";
import { getUsers } from "../../../services/user.service";
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
import EmptyListState from "../../../components/ui/EmptyListState";
import { downloadAnalytiqueReport, printAnalytiqueReport, buildFiltersLabel, formatMoisReport } from "../../../utils/printReport";

const COMPTE_LABELS = {
  total: "Tous les utilisateurs",
  actifs: "Comptes actifs",
  inactifs: "Comptes inactifs",
  connectes_30j: "Connectés (30 j)",
  nouveaux_30j: "Nouveaux (30 j)",
  jamais_connectes: "Jamais connectés",
  sans_groupe: "Sans groupe",
};

function msAgo(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function userDisplayName(user) {
  const full = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return full || user.username;
}

function userMatchesCompte(user, compte) {
  if (!compte || compte === "total") return true;
  if (compte === "actifs") return Boolean(user.is_active);
  if (compte === "inactifs") return !user.is_active;
  if (compte === "jamais_connectes") return !user.last_login;
  if (compte === "sans_groupe") {
    const groups = user.groups_detail || user.groups || [];
    return groups.length === 0;
  }
  if (compte === "connectes_30j") {
    return Boolean(user.last_login) && new Date(user.last_login).getTime() >= msAgo(30);
  }
  if (compte === "nouveaux_30j") {
    return Boolean(user.date_joined) && new Date(user.date_joined).getTime() >= msAgo(30);
  }
  if (compte.startsWith("mois:")) {
    const mois = compte.slice(5);
    if (!user.date_joined) return false;
    const d = new Date(user.date_joined);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return key === mois;
  }
  return true;
}

function userInGroup(user, groupId) {
  if (!groupId) return true;
  const id = Number(groupId);
  if ((user.groups_detail || []).some((g) => Number(g.id) === id)) return true;
  return (user.groups || []).some((g) => Number(g) === id);
}

function formatLogin(value) {
  if (!value) return "Jamais";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value)
    );
  } catch {
    return "—";
  }
}

function MetricTile({ label, value, hint, tone = "slate", active = false, onClick, href }) {
  const tones = {
    slate: "bg-slate-50 border-slate-100 text-slate-800",
    green: "bg-emerald-50 border-emerald-100 text-emerald-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    red: "bg-rose-50 border-rose-100 text-rose-800",
    purple: "bg-purple-50 border-purple-100 text-purple-800",
  };
  const interactive = Boolean(onClick || href);
  const className = `
    rounded-xl border p-4 text-left transition-all w-full
    ${tones[tone] || tones.slate}
    ${interactive ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}
    ${active ? "ring-2 ring-purple-500 ring-offset-1" : ""}
  `;
  const inner = (
    <>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

function SummaryBox({ total, actifs, connectes, nouveaux, activeKey, onSelect }) {
  const items = [
    { key: "actifs", label: "Comptes actifs", value: actifs },
    { key: "connectes_30j", label: "Connectés (30 j)", value: connectes },
    { key: "nouveaux_30j", label: "Nouveaux (30 j)", value: nouveaux },
  ];
  return (
    <div className="rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 shadow-lg">
      <p className="text-purple-200 text-sm font-medium">Vue d&apos;ensemble</p>
      <button
        type="button"
        onClick={() => onSelect("total")}
        className={`text-left mt-1 rounded-lg px-1 -mx-1 ${
          activeKey === "total" ? "ring-2 ring-white/80" : "hover:bg-white/10"
        }`}
      >
        <p className="text-3xl font-bold">{total ?? "—"} utilisateurs</p>
        <p className="text-xs text-purple-200 mt-0.5">Cliquez pour lister tous les comptes</p>
      </button>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`text-left rounded-lg p-2 -m-2 transition ${
              activeKey === item.key ? "bg-white/20 ring-1 ring-white/70" : "hover:bg-white/10"
            }`}
          >
            <p className="text-purple-200">{item.label}</p>
            <p className="text-xl font-semibold">{item.value ?? "—"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupesSimpleTable({ data = [], activeId, onRowClick }) {
  if (data.length === 0) {
    return (
      <EmptyListState
        compact
        icon="folder"
        tone="purple"
        title="Aucun groupe configuré"
        description="Les groupes de sécurité apparaîtront ici une fois créés."
      />
    );
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
          {data.map((row) => {
            const isActive = activeId && String(activeId) === String(row.id);
            return (
              <tr
                key={row.id || row.groupe}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-50 ${
                  onRowClick ? "cursor-pointer hover:bg-purple-50/70" : ""
                } ${isActive ? "bg-purple-50" : ""}`}
              >
                <td className="py-2.5 font-medium text-slate-800">{row.groupe}</td>
                <td className="py-2.5 text-right tabular-nums">{row.membres}</td>
                <td className="py-2.5 text-right tabular-nums">{row.localites}</td>
                <td className="py-2.5 text-right tabular-nums">{row.types_documents}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UsersDetailPanel({ title, users, manageHref, onClear }) {
  return (
    <SectionCard
      title={title}
      subtitle={`${users.length} utilisateur${users.length !== 1 ? "s" : ""} — cliquez une ligne pour ouvrir la fiche`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Link
          href={manageHref}
          className="text-sm font-medium text-purple-700 hover:text-purple-900 hover:underline"
        >
          Gérer dans Utilisateurs →
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Réinitialiser
        </button>
      </div>
      {users.length === 0 ? (
        <EmptyListState
          compact
          icon="users"
          tone="purple"
          title="Aucun utilisateur dans ce filtre"
          description="Aucun compte ne correspond à l’indicateur sélectionné."
        />
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Utilisateur</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Groupes</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Dernière connexion</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/gestion_acces/utilisateurs?user=${user.id}`}
                      className="font-medium text-purple-700 hover:underline"
                    >
                      {userDisplayName(user)}
                    </Link>
                    <div className="text-xs text-slate-400">{user.username}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{user.email || "—"}</td>
                  <td className="px-3 py-2">
                    {(user.groups_detail || []).length
                      ? (user.groups_detail || []).map((g) => g.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {formatLogin(user.last_login)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {user.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export default function AnalytiqueAdministrationPage() {
  const canView = hasAnyPermission([
    PERMISSIONS.VIEW_USER,
    PERMISSIONS.VIEW_GROUP,
  ]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, setFilter, buildUrl } = useAnalytiqueFilters();
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const compteFilter = searchParams.get("compte") || "";
  const groupeFilter = searchParams.get("groupe") || "";

  const setAdminQuery = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
        else params.delete(key);
      });
      const qs = params.toString();
      // API History : router.replace vers la page sans paramètres les restaure depuis le cache (Next 16.2.x).
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams]
  );

  const toggleCompte = (key) => {
    setAdminQuery({
      compte: compteFilter === key ? "" : key,
      groupe: "",
    });
  };

  const toggleGroupe = (groupId) => {
    const next = String(groupId || "");
    setAdminQuery({
      groupe: groupeFilter === next ? "" : next,
      compte: "",
    });
  };

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [result, usersData] = await Promise.all([
        getAnalyticsAdministration(filters),
        getUsers().catch(() => []),
      ]);
      setData(result);
      setUsers(Array.isArray(usersData) ? usersData : []);
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

  const kpis = data?.kpis ?? {};

  const detailUsers = useMemo(() => {
    return users.filter((user) => {
      if (groupeFilter && !userInGroup(user, groupeFilter)) return false;
      if (compteFilter && !userMatchesCompte(user, compteFilter)) return false;
      return Boolean(compteFilter || groupeFilter);
    });
  }, [users, compteFilter, groupeFilter]);

  const groupeName = useMemo(() => {
    if (!groupeFilter) return "";
    const fromStats = (data?.utilisateurs_par_groupe ?? []).find(
      (g) => String(g.id) === String(groupeFilter)
    );
    if (fromStats?.groupe) return fromStats.groupe;
    const fromCover = (data?.couverture_groupes ?? []).find(
      (g) => String(g.id) === String(groupeFilter)
    );
    return fromCover?.groupe || `Groupe #${groupeFilter}`;
  }, [data, groupeFilter]);

  const detailTitle = groupeFilter
    ? `Membres — ${groupeName}`
    : COMPTE_LABELS[compteFilter] ||
      (compteFilter.startsWith("mois:")
        ? `Comptes créés en ${formatMoisReport(compteFilter.slice(5))}`
        : "Utilisateurs");

  const manageHref = groupeFilter
    ? `/gestion_acces/utilisateurs?groupe=${encodeURIComponent(groupeFilter)}`
    : `/gestion_acces/utilisateurs${
        compteFilter && !compteFilter.startsWith("mois:")
          ? `?etat=${encodeURIComponent(compteFilter)}`
          : compteFilter.startsWith("mois:")
            ? `?etat=nouveaux_30j&mois=${encodeURIComponent(compteFilter.slice(5))}`
            : ""
      }`;

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

  if (!canView) {
    return (
      <NoPermissionMessage message="Vous n'avez pas la permission de consulter les statistiques utilisateurs." />
    );
  }

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
        subtitle="Cliquez sur un indicateur, un groupe ou un graphique pour voir le détail"
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
            {filters.periode === "custom" && (
              <option value="custom">Période personnalisée</option>
            )}
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
            activeKey={compteFilter}
            onSelect={toggleCompte}
          />

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">État des comptes</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricTile
                label="Comptes actifs"
                value={kpis.utilisateurs_actifs}
                hint="Cliquez pour lister les comptes"
                tone="green"
                active={compteFilter === "actifs"}
                onClick={() => toggleCompte("actifs")}
              />
              <MetricTile
                label="Comptes inactifs"
                value={kpis.utilisateurs_inactifs}
                hint="Cliquez pour lister les désactivés"
                tone="amber"
                active={compteFilter === "inactifs"}
                onClick={() => toggleCompte("inactifs")}
              />
              <MetricTile
                label="Jamais connectés"
                value={kpis.jamais_connectes}
                hint="Cliquez pour voir qui n'a jamais ouvert une session"
                tone="red"
                active={compteFilter === "jamais_connectes"}
                onClick={() => toggleCompte("jamais_connectes")}
              />
              <MetricTile
                label="Sans groupe"
                value={kpis.sans_groupe}
                hint="Cliquez pour lister les comptes sans rôle"
                tone="red"
                active={compteFilter === "sans_groupe"}
                onClick={() => toggleCompte("sans_groupe")}
              />
            </div>
          </section>

          {(compteFilter || groupeFilter) && (
            <UsersDetailPanel
              title={detailTitle}
              users={detailUsers}
              manageHref={manageHref}
              onClear={() => setAdminQuery({ compte: "", groupe: "" })}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title="Utilisateurs par groupe"
              subtitle="Cliquez sur un groupe pour voir ses membres"
            >
              <RankingList
                data={(data?.utilisateurs_par_groupe ?? []).map((g) => ({
                  id: g.id,
                  utilisateur: g.groupe,
                  count: g.membres,
                }))}
                valueLabel="membres"
                colorClass="from-purple-500 to-purple-300"
                emptyMessage="Aucun groupe pour le moment"
                activeKey={groupeFilter}
                onItemClick={(item) => toggleGroupe(item.id)}
              />
            </SectionCard>

            <SectionCard
              title="Nouveaux comptes créés"
              subtitle="Cliquez sur un mois pour voir les comptes créés"
            >
              <SimpleTrendChart
                data={data?.evolution_comptes ?? []}
                color="#6366f1"
                valueLabel="Nouveaux comptes"
                onPointClick={(point) => {
                  if (point?.mois) toggleCompte(`mois:${point.mois}`);
                }}
              />
            </SectionCard>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Accès & partage</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Périmètre des groupes"
                subtitle="Cliquez une ligne pour voir les membres du groupe"
              >
                <GroupesSimpleTable
                  data={data?.couverture_groupes ?? []}
                  activeId={groupeFilter}
                  onRowClick={(row) => row.id && toggleGroupe(row.id)}
                />
              </SectionCard>

              <SectionCard
                title="Liens de téléchargement"
                subtitle="Cliquez un indicateur pour ouvrir la liste des liens"
              >
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Liens actifs"
                    value={kpis.liens_actifs}
                    hint="Ouvrir les liens actifs"
                    tone="green"
                    href="/gestion_acces/liens-telechargement?statut=Actif"
                  />
                  <MetricTile
                    label="Liens expirés"
                    value={kpis.liens_expires}
                    hint="Ouvrir les liens expirés"
                    tone="slate"
                    href="/gestion_acces/liens-telechargement?statut=Expiré"
                  />
                  <MetricTile
                    label="Créés (30 j)"
                    value={kpis.liens_crees_30j}
                    hint="Ouvrir les liens récents"
                    tone="amber"
                    href="/gestion_acces/liens-telechargement?recent=30"
                  />
                  <MetricTile
                    label="Documents partagés"
                    value={kpis.documents_partages}
                    hint="Ouvrir tous les liens"
                    tone="purple"
                    href="/gestion_acces/liens-telechargement"
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
