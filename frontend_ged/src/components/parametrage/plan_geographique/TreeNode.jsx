"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPlanEnfants } from "../../../services/planGeographique.service";
import { scrollPlanNodeIntoView } from "./planGeoScroll";
import VoirPlusButton from "./VoirPlusButton";

const LEVEL_STYLES = [
  { border: "border-l-blue-500", badge: "bg-blue-100 text-blue-800" },
  { border: "border-l-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-800" },
  { border: "border-l-red-500", badge: "bg-red-100 text-red-800" },
  { border: "border-l-purple-500", badge: "bg-purple-100 text-purple-800" },
  { border: "border-l-cyan-500", badge: "bg-cyan-100 text-cyan-800" },
];

function getLevelStyle(level) {
  return LEVEL_STYLES[level] || LEVEL_STYLES[LEVEL_STYLES.length - 1];
}

function nodeHasChildren(node) {
  return Boolean(node?.a_des_enfants || Number(node?.nb_enfants) > 0);
}

function mergeUniqueChildren(current, batch) {
  if (!batch.length) return current;
  const existingIds = new Set(current.map((item) => item.id));
  const uniqueBatch = batch.filter((item) => !existingIds.has(item.id));
  return uniqueBatch.length ? [...current, ...uniqueBatch] : current;
}

function sortByLibelle(nodes) {
  return [...nodes].sort((a, b) =>
    (a.libelle || "").localeCompare(b.libelle || "", "fr", { sensitivity: "base" })
  );
}

export { mergeUniqueChildren };

export default function TreeNode({
  node,
  depth = 0,
  siblingIndex = 1,
  onAddChild,
  onEdit,
  onDelete,
  allowAdd = true,
  allowChange = true,
  allowDelete = true,
  navigationPath = [],
  highlightId = null,
  reloadBranch = null,
  onBranchReloaded,
  childCreatedEvent = null,
  onChildCreatedHandled,
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalChildren, setTotalChildren] = useState(0);
  const [loadError, setLoadError] = useState(null);

  const loadedRef = useRef(false);
  const loadingRef = useRef(false);
  const childrenRef = useRef([]);

  const hasChildren = nodeHasChildren(node) || children.length > 0;
  const childCount = node.nb_enfants ?? totalChildren ?? children.length;
  const levelStyle = getLevelStyle((node.niveau_ordre || 1) - 1);
  const isHighlighted = highlightId === node.id;
  const pathIndex = navigationPath.indexOf(node.id);
  const isOnPath = pathIndex >= 0;
  const isTarget = pathIndex === navigationPath.length - 1;
  const nextPathId =
    pathIndex >= 0 && pathIndex < navigationPath.length - 1
      ? navigationPath[pathIndex + 1]
      : null;

  const resetLocalState = useCallback(() => {
    setExpanded(false);
    setChildren([]);
    childrenRef.current = [];
    setLoading(false);
    setLoadingMore(false);
    setHasMore(false);
    setTotalChildren(0);
    setLoadError(null);
    loadedRef.current = false;
    loadingRef.current = false;
  }, []);

  const fetchChildren = useCallback(
    async (offset, append = false) => {
      const res = await getPlanEnfants(node.id, offset);
      const batch = Array.isArray(res?.results) ? res.results : [];
      setChildren((prev) => {
        const next = append ? mergeUniqueChildren(prev, batch) : batch;
        childrenRef.current = next;
        return next;
      });
      setHasMore(Boolean(res?.has_more));
      setTotalChildren(res?.total ?? batch.length);
      loadedRef.current = true;
      setLoadError(null);
      return batch;
    },
    [node.id]
  );

  const loadChildren = useCallback(async (force = false) => {
    if (!force && (loadedRef.current || loadingRef.current)) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      await fetchChildren(0, false);
    } catch (err) {
      loadedRef.current = false;
      setChildren([]);
      childrenRef.current = [];
      setHasMore(false);
      setLoadError(err.message || "Impossible de charger les éléments");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchChildren]);

  const reloadChildren = useCallback(async () => {
    loadedRef.current = false;
    loadingRef.current = false;
    setChildren([]);
    childrenRef.current = [];
    setHasMore(false);
    setTotalChildren(0);
    setLoadError(null);
    await loadChildren(true);
  }, [loadChildren]);

  const loadMoreChildren = async () => {
    setLoadingMore(true);
    try {
      await fetchChildren(childrenRef.current.length, true);
    } catch (err) {
      setLoadError(err.message || "Impossible de charger plus d'éléments");
    } finally {
      setLoadingMore(false);
    }
  };

  const ensurePathChildLoaded = useCallback(async () => {
    if (!nextPathId) return;
    if (childrenRef.current.some((child) => child.id === nextPathId)) return;

    let offset = childrenRef.current.length;
    let more = true;

    while (more) {
      const res = await getPlanEnfants(node.id, offset);
      const batch = Array.isArray(res?.results) ? res.results : [];
      more = Boolean(res?.has_more);

      if (batch.length === 0) break;

      setChildren((current) => {
        const merged = mergeUniqueChildren(current, batch);
        childrenRef.current = merged;
        return merged;
      });
      setHasMore(more);
      setTotalChildren(res?.total ?? offset + batch.length);
      loadedRef.current = true;

      offset = childrenRef.current.length;
      if (childrenRef.current.some((child) => child.id === nextPathId)) break;
      if (!more) break;
    }
  }, [nextPathId, node.id]);

  const expandNode = useCallback(async () => {
    if (!hasChildren) return;
    setExpanded(true);
    await loadChildren();
  }, [hasChildren, loadChildren]);

  const collapseNode = useCallback(() => {
    setExpanded(false);
  }, []);

  const toggleExpand = useCallback(async () => {
    if (!hasChildren) return;
    if (expanded) {
      collapseNode();
      return;
    }
    await expandNode();
  }, [collapseNode, expandNode, expanded, hasChildren]);

  useEffect(() => {
    resetLocalState();
  }, [node.id, resetLocalState]);

  useEffect(() => {
    const branchId = reloadBranch?.id;
    if (branchId !== node.id) return;

    if (expanded) {
      reloadChildren().finally(() => {
        onBranchReloaded?.();
      });
      return;
    }

    loadedRef.current = false;
    onBranchReloaded?.();
  }, [reloadBranch?.id, reloadBranch?.key, node.id, expanded, reloadChildren, onBranchReloaded]);

  useEffect(() => {
    if (!childCreatedEvent || childCreatedEvent.parentId !== node.id) return;

    const batch = Array.isArray(childCreatedEvent.children)
      ? childCreatedEvent.children
      : childCreatedEvent.child
        ? [childCreatedEvent.child]
        : [];
    if (!batch.length) {
      onChildCreatedHandled?.();
      return;
    }

    setExpanded(true);
    setChildren((prev) => {
      const next = sortByLibelle(mergeUniqueChildren(prev, batch));
      childrenRef.current = next;
      return next;
    });
    setTotalChildren((prev) => Math.max(prev, childrenRef.current.length));
    setHasMore(false);
    loadedRef.current = true;
    setLoadError(null);
    onChildCreatedHandled?.();
  }, [childCreatedEvent?.key, childCreatedEvent, node.id, onChildCreatedHandled]);

  useEffect(() => {
    if (navigationPath.length === 0 || !isOnPath || !hasChildren) return;

    let cancelled = false;

    (async () => {
      setExpanded(true);
      await loadChildren();
      if (cancelled) return;
      await ensurePathChildLoaded();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationPath, node.id]);

  useEffect(() => {
    if (navigationPath.length === 0 || !isTarget) return;

    let attempts = 0;
    const maxAttempts = 20;
    let timerId = null;

    const tryScroll = () => {
      if (scrollPlanNodeIntoView(node.id)) return;
      attempts += 1;
      if (attempts < maxAttempts) {
        timerId = window.setTimeout(tryScroll, 150);
      }
    };

    timerId = window.setTimeout(tryScroll, 200);

    return () => {
      if (timerId) window.clearTimeout(timerId);
    };
  }, [navigationPath, node.id, isTarget]);

  return (
    <div className={`${depth > 0 ? "ml-4 mt-2" : "mt-2"}`}>
      <div
        id={`plan-node-${node.id}`}
        className={`
          group bg-white rounded-lg border border-gray-200 border-l-4 ${levelStyle.border}
          shadow-sm hover:shadow-md transition-all duration-200
          ${isHighlighted ? "ring-2 ring-blue-500 ring-offset-1" : ""}
        `}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div
            role={hasChildren ? "button" : undefined}
            tabIndex={hasChildren ? 0 : undefined}
            onClick={hasChildren ? () => { toggleExpand(); } : undefined}
            onKeyDown={
              hasChildren
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand();
                    }
                  }
                : undefined
            }
            className={`flex items-center gap-3 min-w-0 flex-1 select-none ${
              hasChildren ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <span
              className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md ${
                hasChildren ? "text-gray-500 group-hover:text-blue-600" : "invisible"
              }`}
            >
              {loading ? (
                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded min-w-[1.5rem] text-center shrink-0 ${levelStyle.badge}`}
                  title={`Élément n°${siblingIndex} à ce niveau`}
                >
                  {siblingIndex}
                </span>
                {node.niveau_libelle && (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase shrink-0 ${levelStyle.badge}`}>
                    {node.niveau_libelle}
                  </span>
                )}
                {hasChildren && (
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded min-w-[1.5rem] text-center shrink-0">
                    {childCount}
                  </span>
                )}
                <span className="font-semibold text-gray-800 truncate" title={node.libelle}>
                  {node.libelle}
                </span>
              </div>
            </div>
          </div>

          {(allowAdd || allowChange || allowDelete) && (
          <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover:opacity-100">
            {allowAdd && node.can_add_child && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node);
                }}
                className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
                title="Ajouter une sous-localité"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}

            {allowChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
              className="p-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition"
              title="Modifier"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            )}

            {allowDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
              className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
              title="Supprimer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            )}
          </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-l border-dashed border-gray-300 ml-3 pl-1">
          {loading && children.length === 0 && (
            <p className="text-sm text-gray-500 py-2 pl-2">Chargement...</p>
          )}
          {loadError && children.length === 0 && (
            <p className="text-sm text-red-500 py-2 pl-2">{loadError}</p>
          )}
          {children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              siblingIndex={index + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              allowAdd={allowAdd}
              allowChange={allowChange}
              allowDelete={allowDelete}
              navigationPath={navigationPath}
              highlightId={highlightId}
              reloadBranch={reloadBranch}
              onBranchReloaded={onBranchReloaded}
              childCreatedEvent={childCreatedEvent}
              onChildCreatedHandled={onChildCreatedHandled}
            />
          ))}
          {hasMore && (
            <VoirPlusButton
              onClick={loadMoreChildren}
              loading={loadingMore}
              loaded={children.length}
              total={totalChildren}
            />
          )}
        </div>
      )}
    </div>
  );
}
