// Page consultation du plan de classement (lecture seule, sans ajout / modification / suppression)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPlansGeographiques,
  getPlanGeographiqueCompteur,
  getPlanRechercheById,
  PLAN_GEO_PAGE_SIZE,
} from "../../../services/planGeographique.service";
import { getStructuresGeographiques } from "../../../services/structureGeo.service";
import PlanGeoTree from "../../../components/gestion_documentaire/plan_geographique/PlanGeoTree";
import { PLAN_GEO_TREE_SCROLL_ID } from "../../../components/gestion_documentaire/plan_geographique/planGeoScroll";
import {
  clearPlanGeoReturnState,
  consumePlanGeoReturnState,
  peekPlanGeoReturnState,
  PLAN_GEO_PATH,
  PLAN_GEO_RESTORE_TREE_PARAM,
  restorePlanGeoScrollTop,
  savePlanGeoReturnState,
} from "../../../components/gestion_documentaire/plan_geographique/planGeoNavigationState";
import PlanGeoSearch from "../../../components/gestion_documentaire/plan_geographique/PlanGeoSearch";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";

/** Filtre le plan selon les localités assignées aux groupes de l'utilisateur. */
const FILTER_ACCESS = true;

export default function PlanGeographiqueConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postSaveHandledRef = useRef(false);
  const returnRestoreHandledRef = useRef(false);
  const { canAdd: canAttachDocument } = useCrudPermissions(MODELS.DOCUMENT_LOCALITE);

  const [data, setData] = useState([]);
  const [rootsHasMore, setRootsHasMore] = useState(false);
  const [rootsTotal, setRootsTotal] = useState(0);
  const [planTotal, setPlanTotal] = useState(0);
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navigationPath, setNavigationPath] = useState([]);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [highlightId, setHighlightId] = useState(null);
  const [reloadBranchId, setReloadBranchId] = useState(null);
  const [autoScrollToTarget, setAutoScrollToTarget] = useState(true);
  const [notification, setNotification] = useState(null);

  // Affiche une notification temporaire en haut à droite
  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Charge les racines du plan et les niveaux géographiques
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const plansRes = await getPlansGeographiques(0, PLAN_GEO_PAGE_SIZE, FILTER_ACCESS);
      setData(Array.isArray(plansRes?.results) ? plansRes.results : []);
      setRootsHasMore(Boolean(plansRes?.has_more));
      setRootsTotal(plansRes?.total ?? 0);
      setPlanTotal(plansRes?.total ?? 0);
      setLoading(false);
      getStructuresGeographiques()
        .then((strucs) => {
          setStructures(Array.isArray(strucs) ? strucs.sort((a, b) => a.ordre - b.ordre) : []);
        })
        .catch(() => {});
      getPlanGeographiqueCompteur(FILTER_ACCESS)
        .then((compteurRes) => {
          setRootsTotal(compteurRes?.total_racines ?? plansRes?.total ?? 0);
          setPlanTotal(compteurRes?.total ?? plansRes?.total ?? 0);
        })
        .catch(() => {});
    } catch (err) {
      setError(err.message || "Erreur lors du chargement");
      showNotification(err.message || "Erreur lors du chargement", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const clearBranchReload = useCallback(() => {
    setReloadBranchId(null);
  }, []);

  // Déroule l'arborescence jusqu'à une localité et rafraîchit le compteur de documents
  const revealLocalite = useCallback(async (localiteId, chemin) => {
    const targetId = Number(localiteId);
    let pathIds = (chemin || []).map((item) => Number(item.id));

    if (!pathIds.length) {
      const found = await getPlanRechercheById(targetId, FILTER_ACCESS);
      if (!found?.chemin?.length) {
        throw new Error("Localité introuvable dans le plan de classement");
      }
      pathIds = found.chemin.map((item) => Number(item.id));
    }

    const rootId = pathIds[0];
    if (rootId) {
      let roots = [];
      let offset = 0;
      let hasMore = true;
      let total = 0;

      while (hasMore) {
        const res = await getPlansGeographiques(offset, PLAN_GEO_PAGE_SIZE, FILTER_ACCESS);
        const batch = Array.isArray(res?.results) ? res.results : [];
        roots = [...roots, ...batch];
        hasMore = Boolean(res?.has_more);
        total = res?.total ?? roots.length;
        offset = roots.length;
        if (roots.some((node) => node.id === rootId)) break;
        if (!hasMore) break;
      }

      if (pathIds.length === 1) {
        const limit = Math.max(roots.length, PLAN_GEO_PAGE_SIZE);
        const plansRes = await getPlansGeographiques(0, limit, FILTER_ACCESS);
        setData(Array.isArray(plansRes?.results) ? plansRes.results : []);
        setRootsHasMore(Boolean(plansRes?.has_more));
        const compteurRes = await getPlanGeographiqueCompteur(FILTER_ACCESS);
        setRootsTotal(compteurRes?.total_racines ?? plansRes?.total ?? 0);
        setPlanTotal(compteurRes?.total ?? 0);
      } else {
        setData(roots);
        setRootsHasMore(hasMore);
        const compteurRes = await getPlanGeographiqueCompteur(FILTER_ACCESS);
        setRootsTotal(compteurRes?.total_racines ?? total);
        setPlanTotal(compteurRes?.total ?? total);
      }
    }

    setNavigationPath(pathIds);
    setExpandedIds((prev) => new Set([...prev, ...pathIds]));
    setHighlightId(targetId);
    setTimeout(() => setHighlightId(null), 4000);

    const parentId = pathIds.length > 1 ? pathIds[pathIds.length - 2] : null;
    if (parentId) {
      setReloadBranchId(parentId);
    }
  }, []);

  /** Rétablit dépliage, chemin et scroll à partir d'un état sessionStorage. */
  const applySavedTreeState = useCallback(
    async (saved) => {
      if (!saved?.localiteId) return;
      const pathIds = (saved.navigationPath || []).map(Number).filter(Boolean);
      const expanded = new Set([
        ...(saved.expandedNodeIds || []).map(Number),
        ...pathIds,
      ]);
      setExpandedIds(expanded);
      setAutoScrollToTarget(false);
      await revealLocalite(saved.localiteId, pathIds.map((id) => ({ id })));
      restorePlanGeoScrollTop(saved.scrollTop, PLAN_GEO_TREE_SCROLL_ID);
      window.setTimeout(() => setAutoScrollToTarget(true), 800);
    },
    [revealLocalite]
  );

  /** Mémorise l'état de l'arbre avant d'ouvrir documents ou rattachement. */
  const persistTreeStateBeforeLeave = useCallback(
    async (node) => {
      const scrollEl = document.getElementById(PLAN_GEO_TREE_SCROLL_ID);
      let pathIds = navigationPath.map(Number);

      if (!pathIds.includes(Number(node.id))) {
        try {
          const found = await getPlanRechercheById(node.id, FILTER_ACCESS);
          pathIds = (found?.chemin ?? []).map((item) => Number(item.id));
        } catch {
          pathIds = [Number(node.id)];
        }
      }

      savePlanGeoReturnState({
        localiteId: node.id,
        navigationPath: pathIds,
        expandedNodeIds: Array.from(expandedIds),
        scrollTop: scrollEl?.scrollTop ?? 0,
      });
    },
    [navigationPath, expandedIds]
  );

  // Après rattachement : retour automatique avec mise à jour du badge « X docs »
  useEffect(() => {
    if (loading || postSaveHandledRef.current) return;

    const docSaved = searchParams.get("docSaved");
    const localiteIdParam = searchParams.get("localiteId");
    const qcAccessDenied = searchParams.get("qcAccessDenied") === "1";
    if (docSaved !== "1" || !localiteIdParam) return;

    postSaveHandledRef.current = true;
    returnRestoreHandledRef.current = true;
    const localiteId = Number(localiteIdParam);

    (async () => {
      try {
        const saved = peekPlanGeoReturnState();
        if (saved?.localiteId === localiteId) {
          await applySavedTreeState(saved);
          consumePlanGeoReturnState();
        } else {
          await revealLocalite(localiteId);
        }
        if (qcAccessDenied) {
          showNotification(
            "Document enregistré avec succès. Vous n'avez pas les droits nécessaires pour accéder au module contrôle qualité.",
            "warning"
          );
        } else {
          showNotification("Document enregistré avec succès", "success");
        }
        router.replace("/gestion_documentaire/plan_geographique", { scroll: false });
      } catch (err) {
        showNotification(
          err.message || "Document enregistré, mais impossible d'afficher la localité",
          "error"
        );
        router.replace("/gestion_documentaire/plan_geographique", { scroll: false });
      }
    })();
  }, [loading, searchParams, revealLocalite, applySavedTreeState, showNotification, router]);

  // Retour depuis liste documents ou page rattacher : rétablit dépliage et scroll
  useEffect(() => {
    if (loading || returnRestoreHandledRef.current) return;
    if (searchParams.get("docSaved") === "1") return;

    const shouldRestore = searchParams.get(PLAN_GEO_RESTORE_TREE_PARAM) === "1";
    if (!shouldRestore) {
      clearPlanGeoReturnState();
      return;
    }

    const saved = consumePlanGeoReturnState();
    if (!saved?.localiteId) return;

    returnRestoreHandledRef.current = true;

    (async () => {
      try {
        await applySavedTreeState(saved);
        router.replace(PLAN_GEO_PATH, { scroll: false });
      } catch (err) {
        showNotification(err.message || "Impossible de restaurer le plan de classement", "error");
        router.replace(PLAN_GEO_PATH, { scroll: false });
      }
    })();
  }, [loading, searchParams, applySavedTreeState, showNotification, router]);

  // Charge la page suivante des éléments racine
  const handleLoadMoreRoots = async () => {
    try {
      setLoadingMoreRoots(true);
      const res = await getPlansGeographiques(data.length, PLAN_GEO_PAGE_SIZE, FILTER_ACCESS);
      setData((prev) => [...prev, ...(Array.isArray(res?.results) ? res.results : [])]);
      setRootsHasMore(Boolean(res?.has_more));
      const compteurRes = await getPlanGeographiqueCompteur(FILTER_ACCESS);
      setRootsTotal(compteurRes?.total_racines ?? res?.total ?? data.length);
      setPlanTotal(compteurRes?.total ?? 0);
    } catch (err) {
      showNotification(err.message || "Erreur lors du chargement", "error");
    } finally {
      setLoadingMoreRoots(false);
    }
  };

  // Déroule l'arborescence jusqu'à la localité trouvée par la recherche
  const handleSearchSelect = async (result) => {
    try {
      await revealLocalite(result.id, result.chemin);
    } catch (err) {
      showNotification(err.message || "Impossible d'afficher la localité", "error");
    }
  };

  // Ouvre la page de rattachement (mémorise l'état de l'arbre avant navigation)
  const handleAttachDocument = async (node) => {
    await persistTreeStateBeforeLeave(node);
    router.push(`/gestion_documentaire/plan_geographique/${node.id}/rattacher`);
  };

  // Bascule déplié / replié d'un nœud (état global pour restauration au retour)
  const handleToggleExpand = useCallback((nodeId, shouldExpand) => {
    const id = Number(nodeId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (shouldExpand) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Ouvre la liste des documents (mémorise l'état de l'arbre avant navigation)
  const handleViewDocuments = async (node) => {
    await persistTreeStateBeforeLeave(node);
    router.push(`/gestion_documentaire/plan_geographique/${node.id}/documents`);
  };

  return (
    <div className="min-h-screen bg-transparent">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-slide-in-right">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg flex items-center gap-3 text-white ${
              notification.type === "error"
                ? "bg-red-500"
                : notification.type === "warning"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="p-2">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Plan de classement</h1>
            <nav className="mt-2">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button type="button" onClick={() => router.push("/")} className="hover:text-emerald-600 transition">
                    Accueil
                  </button>
                </li>
                <li><span>/</span></li>
                <li className="text-gray-400">Gestion Documentaire</li>
                <li><span>/</span></li>
                <li className="text-gray-700 font-medium">Plan de classement</li>
              </ol>
            </nav>
            <p className="mt-2 text-sm text-gray-500">
              Plan des sites de rattachement des documents.
            </p>
          </div>
        </div>

        {structures.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {structures.map((s, index) => {
              const colors = [
                "bg-blue-100 text-blue-800 border-blue-200",
                "bg-emerald-100 text-emerald-800 border-emerald-200",
                "bg-amber-100 text-amber-800 border-amber-200",
                "bg-red-100 text-red-800 border-red-200",
                "bg-purple-100 text-purple-800 border-purple-200",
                "bg-cyan-100 text-cyan-800 border-cyan-200",
              ];
              return (
                <span
                  key={s.id}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[index] || colors[colors.length - 1]}`}
                >
                  {s.ordre}. {s.libelle}
                </span>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h5 className="text-lg font-semibold text-gray-800">Recherche par site</h5>
              {planTotal > 0 && (
                <span className="text-sm text-gray-500">
                  Total : <span className="font-semibold text-emerald-600">{planTotal}</span>
                </span>
              )}
            </div>
            <PlanGeoSearch onSelect={handleSearchSelect} filterAccess={FILTER_ACCESS} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <h5 className="text-lg font-semibold text-gray-800">Plan de Classement</h5>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <strong>Erreur :</strong> {error}
                <button type="button" onClick={load} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition">
                  Réessayer
                </button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                <p className="mt-4 text-gray-500">Chargement…</p>
              </div>
            ) : (
              <div
                id={PLAN_GEO_TREE_SCROLL_ID}
                className="min-h-[560px] max-h-[calc(100vh-240px)] overflow-y-auto pr-1"
              >
                <PlanGeoTree
                  data={data}
                  readOnly
                  filterAccess={FILTER_ACCESS}
                  allowAttach={canAttachDocument}
                  onAttach={canAttachDocument ? handleAttachDocument : undefined}
                  onViewDocuments={handleViewDocuments}
                  navigationPath={navigationPath}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  autoScrollToTarget={autoScrollToTarget}
                  highlightId={highlightId}
                  reloadBranchId={reloadBranchId}
                  onBranchReloaded={clearBranchReload}
                  rootsHasMore={rootsHasMore}
                  rootsTotal={rootsTotal}
                  onLoadMoreRoots={handleLoadMoreRoots}
                  loadingMoreRoots={loadingMoreRoots}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
