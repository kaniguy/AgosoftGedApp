"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPlansGeographiques,
  getPlanGeographiqueCompteur,
  createPlanGeographique,
  addChildPlanGeographique,
  updatePlanGeographique,
  deletePlanGeographique,
  PLAN_GEO_PAGE_SIZE,
} from "../../../services/planGeographique.service";
import { getStructuresGeographiques } from "../../../services/structureGeo.service";
import PlanGeoTree from "../../../components/parametrage/plan_geographique/PlanGeoTree";
import { mergeUniqueChildren } from "../../../components/parametrage/plan_geographique/TreeNode";
import { PLAN_GEO_TREE_SCROLL_ID } from "../../../components/parametrage/plan_geographique/planGeoScroll";
import PlanGeoSearch from "../../../components/parametrage/plan_geographique/PlanGeoSearch";
import PlanGeoFormFields, {
  EMPTY_PLAN_FORM,
  buildPayload,
  nodeToFormData,
  validatePlanForm,
} from "../../../components/parametrage/plan_geographique/PlanGeoFormFields";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";
import { parseLibellesFromPlus } from "../../../utils/parseLibelles";

export default function PlanGeographiquePage() {
  const router = useRouter();
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.PLAN_GEOGRAPHIQUE);

  const [data, setData] = useState([]);
  const [rootsHasMore, setRootsHasMore] = useState(false);
  const [rootsTotal, setRootsTotal] = useState(0);
  const [planTotal, setPlanTotal] = useState(0);
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navigationPath, setNavigationPath] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [reloadBranch, setReloadBranch] = useState(null);
  const [childCreatedEvent, setChildCreatedEvent] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PLAN_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const premierNiveau = structures[0];

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const [plansRes, strucs] = await Promise.all([
        getPlansGeographiques(0),
        getStructuresGeographiques(),
      ]);
      setData(Array.isArray(plansRes?.results) ? plansRes.results : []);
      setRootsHasMore(Boolean(plansRes?.has_more));
      setRootsTotal(plansRes?.total ?? 0);
      setPlanTotal(plansRes?.total ?? 0);
      setStructures(Array.isArray(strucs) ? strucs.sort((a, b) => a.ordre - b.ordre) : []);
      getPlanGeographiqueCompteur()
        .then((compteurRes) => {
          setRootsTotal(compteurRes?.total_racines ?? plansRes?.total ?? 0);
          setPlanTotal(compteurRes?.total ?? plansRes?.total ?? 0);
        })
        .catch(() => {});
    } catch (err) {
      setError(err.message || "Erreur lors du chargement");
      if (!silent) {
        showNotification(err.message || "Erreur lors du chargement", "error");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [showNotification]);

  const refreshPlans = useCallback(async () => {
    try {
      const compteurRes = await getPlanGeographiqueCompteur();
      const totalRoots = compteurRes?.total_racines ?? 0;
      const limit = Math.max(data.length, PLAN_GEO_PAGE_SIZE, totalRoots);
      const plansRes = await getPlansGeographiques(0, limit);
      setData(Array.isArray(plansRes?.results) ? plansRes.results : []);
      setRootsHasMore(Boolean(plansRes?.has_more));
      setRootsTotal(compteurRes?.total_racines ?? plansRes?.total ?? 0);
      setPlanTotal(compteurRes?.total ?? 0);
    } catch (err) {
      showNotification(err.message || "Erreur lors du rafraîchissement", "error");
    }
  }, [data.length, showNotification]);

  const requestBranchReload = useCallback((parentId) => {
    if (parentId) {
      setReloadBranch({ id: parentId, key: Date.now() });
    }
  }, []);

  const clearBranchReload = useCallback(() => {
    setReloadBranch(null);
  }, []);

  const clearChildCreatedEvent = useCallback(() => {
    setChildCreatedEvent(null);
  }, []);

  const applyCreatedPlans = useCallback((createdItems, parentId) => {
    if (!createdItems.length) return;

    if (!parentId) {
      setData((prev) => {
        const merged = mergeUniqueChildren(prev, createdItems);
        return merged.sort((a, b) =>
          (a.libelle || "").localeCompare(b.libelle || "", "fr", { sensitivity: "base" })
        );
      });
      setRootsTotal((prev) => prev + createdItems.length);
      setPlanTotal((prev) => prev + createdItems.length);
      return;
    }

    setData((prev) =>
      prev.map((node) =>
        node.id === parentId
          ? {
              ...node,
              nb_enfants: (node.nb_enfants || 0) + createdItems.length,
              a_des_enfants: true,
            }
          : node
      )
    );
    setChildCreatedEvent({
      parentId,
      children: createdItems,
      key: Date.now(),
    });
    setPlanTotal((prev) => prev + createdItems.length);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLoadMoreRoots = async () => {
    try {
      setLoadingMoreRoots(true);
      const res = await getPlansGeographiques(data.length);
      setData((prev) => [...prev, ...(Array.isArray(res?.results) ? res.results : [])]);
      setRootsHasMore(Boolean(res?.has_more));
      const compteurRes = await getPlanGeographiqueCompteur();
      setRootsTotal(compteurRes?.total_racines ?? res?.total ?? data.length);
      setPlanTotal(compteurRes?.total ?? 0);
    } catch (err) {
      showNotification(err.message || "Erreur lors du chargement", "error");
    } finally {
      setLoadingMoreRoots(false);
    }
  };

  const handleSearchSelect = async (result) => {
    const pathIds = (result.chemin || []).map((item) => item.id);
    const rootId = pathIds[0];

    if (rootId) {
      let roots = data;
      let hasMore = rootsHasMore;

      while (!roots.some((node) => node.id === rootId) && hasMore) {
        const res = await getPlansGeographiques(roots.length);
        const batch = Array.isArray(res?.results) ? res.results : [];
        roots = [...roots, ...batch];
        setData(roots);
        hasMore = Boolean(res?.has_more);
        setRootsHasMore(hasMore);
        setRootsTotal(res?.total ?? roots.length);
      }
    }

    setNavigationPath(pathIds);
    setHighlightId(result.id);
    setTimeout(() => setHighlightId(null), 3000);
  };

  const openAddModal = (parent = null) => {
    setSelectedParent(parent);
    setFormData(EMPTY_PLAN_FORM);
    setFormErrors({});
    setShowAddModal(true);
  };

  const openEditModal = (node) => {
    setSelectedNode(node);
    setFormData(nodeToFormData(node));
    setFormErrors({});
    setShowEditModal(true);
  };

  const openDeleteModal = (node) => {
    setSelectedNode(node);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedParent(null);
    setSelectedNode(null);
    setFormData(EMPTY_PLAN_FORM);
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === "code") newValue = value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleAdd = async (e) => {
    e?.preventDefault?.();
    await submitAdd(true);
  };

  const submitAdd = async (closeAfter = true) => {
    const libelles = parseLibellesFromPlus(formData.libelle);
    const errors = validatePlanForm({ ...formData, libelle: libelles[0] || "" });
    if (libelles.length === 0) {
      errors.libelle = "Le libellé est requis";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const parentId = selectedParent?.id ?? null;
    const sharedPayload = buildPayload(formData);

    try {
      setSubmitting(true);
      const createdItems = [];

      if (libelles.length === 1) {
        const created = selectedParent
          ? await addChildPlanGeographique(selectedParent.id, sharedPayload)
          : await createPlanGeographique(sharedPayload);
        createdItems.push(created);
        showNotification(
          selectedParent ? "Sous-localité ajoutée avec succès" : "Localité racine ajoutée avec succès"
        );
      } else {
        let created = 0;
        const failures = [];

        for (const libelle of libelles) {
          try {
            const payload = {
              ...sharedPayload,
              libelle,
              code: null,
            };
            const item = selectedParent
              ? await addChildPlanGeographique(selectedParent.id, payload)
              : await createPlanGeographique(payload);
            createdItems.push(item);
            created += 1;
          } catch (err) {
            failures.push(`${libelle} : ${err.message || "erreur"}`);
          }
        }

        if (created === 0) {
          throw new Error(failures[0] || "Aucune localité n'a pu être créée");
        }

        const label = selectedParent ? "sous-localité" : "localité";
        showNotification(
          failures.length
            ? `${created} ${label}(s) créée(s). Échec : ${failures.join(" ; ")}`
            : `${created} ${label}(s) créée(s) avec succès`,
          failures.length ? "error" : "success"
        );
      }

      applyCreatedPlans(createdItems, parentId);
      requestBranchReload(parentId);
      await refreshPlans();
      if (closeAfter) {
        closeModals();
      } else {
        setFormData(EMPTY_PLAN_FORM);
        setFormErrors({});
      }
    } catch (err) {
      showNotification(err.message || "Erreur lors de l'ajout", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const errors = validatePlanForm(formData);
    if (Object.keys(errors).length > 0 || !selectedNode) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      await updatePlanGeographique(selectedNode.id, buildPayload(formData));
      showNotification("Localité modifiée avec succès");
      const parentId = selectedNode.parent ?? null;
      closeModals();
      await refreshPlans();
      requestBranchReload(parentId);
    } catch (err) {
      showNotification(err.message || "Erreur lors de la modification", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;

    try {
      setSubmitting(true);
      await deletePlanGeographique(selectedNode.id);
      showNotification("Localité supprimée avec succès");
      const parentId = selectedNode.parent ?? null;
      closeModals();
      await refreshPlans();
      requestBranchReload(parentId);
    } catch (err) {
      showNotification(err.message || "Erreur lors de la suppression", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-app-screen bg-transparent">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-slide-in-right">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg flex items-center gap-3 text-white ${
              notification.type === "success"
                ? "bg-green-500"
                : notification.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {notification.type === "success" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="p-8">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Plan de classement</h1>
            <nav className="mt-2">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button type="button" onClick={() => router.push("/")} className="hover:text-blue-600 transition">
                    Accueil
                  </button>
                </li>
                <li><span>/</span></li>
                <li className="text-gray-400">Paramétrage</li>
                <li><span>/</span></li>
                <li className="text-gray-700 font-medium">Plan de classement</li>
              </ol>
            </nav>
          </div>

          {canAdd && (
          <button
            onClick={() => openAddModal(null)}
            disabled={!premierNiveau}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition shadow-sm shrink-0"
          >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter une racine
          </button>
          )}
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

        {!premierNiveau && !loading && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            Aucun niveau de classement configuré.{" "}
            <button
              onClick={() => router.push("/parametrage/structure_geographique")}
              className="underline font-medium hover:text-amber-900"
            >
              Configurer les niveaux
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h5 className="text-lg font-semibold text-gray-800">Rechercher un site</h5>
              {planTotal > 0 && (
                <span className="text-sm text-gray-500">
                  Total : <span className="font-semibold text-blue-600">{planTotal}</span>
                </span>
              )}
            </div>
            <PlanGeoSearch onSelect={handleSearchSelect} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <h5 className="text-lg font-semibold text-gray-800">Structure</h5>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <strong>Erreur :</strong> {error}
                <button onClick={load} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition">
                  Réessayer
                </button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="mt-4 text-gray-500">Chargement...</p>
              </div>
            ) : (
              <div
                id={PLAN_GEO_TREE_SCROLL_ID}
                className="min-h-[560px] max-h-[calc(100*var(--app-vh)-240px)] overflow-y-auto pr-1"
              >
                <PlanGeoTree
                  data={data}
                  navigationPath={navigationPath}
                  highlightId={highlightId}
                  reloadBranch={reloadBranch}
                  onBranchReloaded={clearBranchReload}
                  childCreatedEvent={childCreatedEvent}
                  onChildCreatedHandled={clearChildCreatedEvent}
                  rootsHasMore={rootsHasMore}
                  rootsTotal={rootsTotal}
                  onLoadMoreRoots={handleLoadMoreRoots}
                  loadingMoreRoots={loadingMoreRoots}
                  onAddChild={(node) => openAddModal(node)}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                  allowAdd={canAdd}
                  allowChange={canChange}
                  allowDelete={canDelete}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl max-h-[calc(90*var(--app-vh))] overflow-y-auto">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
              <h5 className="text-lg font-semibold">
                {selectedParent ? "Nouvelle sous-localité" : "Nouvelle localité racine"}
              </h5>
              <button type="button" onClick={closeModals} className="text-white hover:text-red-200 text-2xl font-bold leading-none">×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="p-6">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  {selectedParent ? (
                    <>
                      Niveau suivant après <strong>{selectedParent.niveau_libelle}</strong>
                      {" — "}parent : <strong>{selectedParent.libelle}</strong>
                    </>
                  ) : (
                    <>
                      Premier niveau : <strong>{premierNiveau?.ordre}. {premierNiveau?.libelle}</strong>
                    </>
                  )}
                </div>
                <PlanGeoFormFields
                  formData={formData}
                  formErrors={formErrors}
                  onChange={handleInputChange}
                  showBulkLibelleHint
                />
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                <button type="button" onClick={closeModals} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                <button
                  type="button"
                  onClick={() => submitAdd(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition"
                >
                  {submitting ? "Enregistrement..." : "Ajouter & continuer"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition"
                >
                  {submitting ? "Enregistrement..." : "Ajouter & fermer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl max-h-[calc(90*var(--app-vh))] overflow-y-auto">
            <div className="bg-green-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
              <h5 className="text-lg font-semibold">Modifier la localité</h5>
              <button type="button" onClick={closeModals} className="text-white hover:text-red-200 text-2xl font-bold leading-none">×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="p-6">
                <div className="mb-4 text-sm text-gray-500">
                  Niveau : <span className="font-medium text-gray-700">{selectedNode.niveau_ordre}. {selectedNode.niveau_libelle}</span>
                </div>
                <PlanGeoFormFields formData={formData} formErrors={formErrors} onChange={handleInputChange} focusRing="green" />
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                <button type="button" onClick={closeModals} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition">
                  {submitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
              <h5 className="text-lg font-semibold">Supprimer cette localité ?</h5>
              <button type="button" onClick={closeModals} className="text-white hover:text-red-200 text-2xl font-bold leading-none">×</button>
            </div>
            <div className="p-6">
              <p className="text-gray-700">
                Êtes-vous sûr de vouloir supprimer <strong>&quot;{selectedNode.libelle}&quot;</strong> ?
              </p>
              {selectedNode.a_des_enfants && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  Attention : cette localité contient {selectedNode.nb_enfants} sous-élément(s).
                  La suppression entraînera aussi la suppression de toute la branche.
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button type="button" onClick={closeModals} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Annuler</button>
              <button type="button" onClick={handleDelete} disabled={submitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition">
                {submitting ? "Suppression..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
      `}</style>
    </div>
  );
}
