"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PlanGeoSearch from "../../../components/gestion_documentaire/plan_geographique/PlanGeoSearch";
import ControleQualiteArborescence from "../../../components/controle_qualite/ControleQualiteArborescence";
import ControleQualiteListeDetaillee from "../../../components/controle_qualite/ControleQualiteListeDetaillee";
import DocumentColumnFilterBar from "../../../components/gestion_documentaire/documents/DocumentColumnFilterBar";
import { getChampsDocuments } from "../../../services/champsDocument.service";
import { getStructuresGeographiques } from "../../../services/structureGeo.service";
import { getTypesAvecDocuments, hasColumnFilterValues } from "../../../services/documentLocalite.service";
import { getLocalitesDernierNiveau } from "../../../services/group.service";
import {
  getControleQualiteStatutConfig,
  isControleQualiteStatut,
} from "../../../constants/controleQualiteMenu";
import { getDefaultStatutMenu } from "../../../utils/controleQualitePermissions";
import { ControleQualiteStatutGate } from "../../../components/controle_qualite/ControleQualiteAccessGate";
import {
  filterBucketsByBranch,
  normalizeBucket,
  sortBucketsByHierarchy,
} from "../../../utils/controleQualiteBuckets";
import { buildDocumentTableBaseColumns } from "../../../utils/documentGeoColumns";
import { clearChampColumnFilters } from "../../../utils/documentColumnFilters";

const FILTER_ACCESS = true;

function buildChampColumns(champs) {
  return (champs || []).map((c) => ({
    key: `champ_${c.id}`,
    champId: c.id,
    typeChamp: c.type_champ,
    label: c.libelle_champ || `Champ ${c.id}`,
    options: c.options || [],
  }));
}

function ControleQualiteStatutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const statutParam = params?.statut;
  const statut = isControleQualiteStatut(statutParam) ? statutParam : getDefaultStatutMenu();
  const statutConfig = getControleQualiteStatutConfig(statut);

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchFilterId, setBranchFilterId] = useState(null);
  const [highlightCasierId, setHighlightCasierId] = useState(null);
  const [showEmptySites, setShowEmptySites] = useState(false);
  const [structures, setStructures] = useState([]);
  const [typesAvecDocuments, setTypesAvecDocuments] = useState([]);
  const [typeDocumentId, setTypeDocumentId] = useState("");
  const [champsColumns, setChampsColumns] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [viewMode, setViewMode] = useState("grouped");
  const highlightTimerRef = useRef(null);

  const baseColumns = useMemo(
    () => buildDocumentTableBaseColumns(structures, { includeType: true }),
    [structures]
  );
  const filterColumns = useMemo(
    () => [...baseColumns, ...champsColumns],
    [baseColumns, champsColumns]
  );
  const hasActiveColumnFilters = hasColumnFilterValues(columnFilters);

  useEffect(() => {
    if (!isControleQualiteStatut(statutParam)) {
      router.replace(`/controle_qualite/${getDefaultStatutMenu()}`);
    }
  }, [statutParam, router]);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const documentFiltersActive = Boolean(typeDocumentId) || hasActiveColumnFilters;
      const { results } = await getLocalitesDernierNiveau("", FILTER_ACCESS, {
        statutQualite: statut,
        avecDocuments: !showEmptySites || documentFiltersActive,
        typeDocumentId: typeDocumentId || undefined,
        columnFilters,
      });
      setSites((results || []).map(normalizeBucket));
    } catch (err) {
      setError(err.message || "Impossible de charger les casiers.");
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [statut, showEmptySites, typeDocumentId, columnFilters, hasActiveColumnFilters]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    getStructuresGeographiques()
      .then((data) => setStructures(Array.isArray(data) ? data : []))
      .catch(() => setStructures([]));
  }, []);

  const loadTypes = useCallback(async () => {
    try {
      const types = await getTypesAvecDocuments(null, { statutQualite: statut });
      setTypesAvecDocuments(Array.isArray(types) ? types : []);
    } catch {
      setTypesAvecDocuments([]);
    }
  }, [statut]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const loadChampsForType = useCallback(async (typeId) => {
    if (!typeId) {
      setChampsColumns([]);
      return;
    }
    try {
      const data = await getChampsDocuments(typeId);
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.ordre - b.ordre) : [];
      setChampsColumns(buildChampColumns(sorted));
    } catch {
      setChampsColumns([]);
    }
  }, []);

  useEffect(() => {
    loadChampsForType(typeDocumentId);
  }, [typeDocumentId, loadChampsForType]);

  const handleTypeDocumentChange = (value) => {
    setTypeDocumentId(value);
    setColumnFilters((prev) => clearChampColumnFilters(prev));
  };

  const handleColumnFilterApply = (columnKey, filter) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter) next[columnKey] = filter;
      else delete next[columnKey];
      return next;
    });
  };

  const resetColumnFilters = () => {
    setTypeDocumentId("");
    setColumnFilters({});
  };

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const casierParam = searchParams.get("casier");
    if (!casierParam) return;
    const casierId = Number(casierParam);
    if (!casierId) return;
    setHighlightCasierId(casierId);
  }, [searchParams]);

  const visibleCasiers = useMemo(
    () => sortBucketsByHierarchy(filterBucketsByBranch(sites, branchFilterId)),
    [sites, branchFilterId]
  );

  const totalDocuments = useMemo(
    () => visibleCasiers.reduce((sum, site) => sum + (site.nbDocuments || 0), 0),
    [visibleCasiers]
  );

  const handleSearchSelect = useCallback(
    (result) => {
      const targetId = Number(result.id);
      setBranchFilterId(targetId);

      const matching = filterBucketsByBranch(sites, targetId);
      const directCasier = matching.find((s) => Number(s.id) === targetId);

      if (directCasier) {
        setHighlightCasierId(directCasier.id);
      } else if (matching.length === 1) {
        setHighlightCasierId(matching[0].id);
      } else {
        setHighlightCasierId(null);
      }

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setHighlightCasierId(null), 5000);
    },
    [sites]
  );

  const handleSearchClear = () => {
    setBranchFilterId(null);
    setHighlightCasierId(null);
  };

  return (
    <ControleQualiteStatutGate statut={statut}>
      <div className="w-full min-w-0 max-w-full space-y-6">
        <nav className="text-sm flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => router.push("/")} className="text-slate-500 hover:text-yellow-600">
            Accueil
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-yellow-700 font-semibold">Contrôle qualité</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-medium">{statutConfig.label}</span>
        </nav>

        <div>
          <h1 className="text-2xl font-bold text-slate-800">{statutConfig.label}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {statutConfig.subtitle} — ouvrez un casier pour voir et traiter les documents.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Rechercher dans le plan</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEmptySites}
                  onChange={(e) => setShowEmptySites(e.target.checked)}
                  className="rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
                />
                Afficher les casiers vides
              </label>
              {sites.length > 0 && (
                <span className="text-sm text-slate-500">
                  {visibleCasiers.length} casier{visibleCasiers.length > 1 ? "s" : ""}
                  {branchFilterId ? " (filtre actif)" : ""}
                  {totalDocuments > 0 && ` · ${totalDocuments} document${totalDocuments > 1 ? "s" : ""}`}
                </span>
              )}
            </div>
          </div>
          <PlanGeoSearch
            onSelect={handleSearchSelect}
            onClear={handleSearchClear}
            filterAccess={FILTER_ACCESS}
            theme="yellow"
            clearQueryOnSelect={false}
          />

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="qc-filtre-type"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5"
                >
                  Type de document
                </label>
                <select
                  id="qc-filtre-type"
                  value={typeDocumentId}
                  onChange={(e) => handleTypeDocumentChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 cursor-pointer shadow-sm"
                >
                  <option value="">Tous les types</option>
                  {typesAvecDocuments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.libelle} ({t.code}) — {t.count} doc{t.count !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                {typeDocumentId && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Sélectionnez un type pour filtrer sur les champs d&apos;index (ex. BUREAU).
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <DocumentColumnFilterBar
                columns={filterColumns}
                columnFilters={columnFilters}
                onApply={handleColumnFilterApply}
              />
              {(hasActiveColumnFilters || typeDocumentId) && (
                <button
                  type="button"
                  onClick={resetColumnFilters}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-sm"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        )}

        {loading ? (
          <p className="text-slate-400 py-16 text-center">Chargement des casiers…</p>
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {viewMode === "grouped" ? "Casiers — dernier niveau" : "Liste détaillée des documents"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewMode === "grouped"
                    ? "Dépliez un casier pour afficher et traiter ses documents."
                    : "Tous les documents correspondant aux filtres, tous sites confondus."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode("grouped")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                      viewMode === "grouped"
                        ? "bg-white text-yellow-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    Vue groupée
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("detailed")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                      viewMode === "detailed"
                        ? "bg-white text-yellow-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    Liste détaillée
                  </button>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutConfig.badgeClass}`}>
                  {totalDocuments} doc.
                </span>
              </div>
            </div>

            {viewMode === "grouped" ? (
              <ControleQualiteArborescence
                casiers={visibleCasiers}
                statut={statut}
                statutConfig={statutConfig}
                highlightCasierId={highlightCasierId}
                typeDocumentId={typeDocumentId}
                columnFilters={columnFilters}
              />
            ) : (
              <ControleQualiteListeDetaillee
                statut={statut}
                structures={structures}
                typeDocumentId={typeDocumentId}
                columnFilters={columnFilters}
              />
            )}
          </section>
        )}
      </div>
    </ControleQualiteStatutGate>
  );
}

export default function ControleQualiteStatutPage() {
  return (
    <Suspense fallback={<p className="text-slate-400 py-16 text-center">Chargement…</p>}>
      <ControleQualiteStatutContent />
    </Suspense>
  );
}
