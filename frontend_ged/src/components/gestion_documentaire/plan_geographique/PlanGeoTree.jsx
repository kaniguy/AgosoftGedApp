"use client";

import TreeNode from "./TreeNode";
import VoirPlusButton from "./VoirPlusButton";

export default function PlanGeoTree({
  data,
  readOnly = false,
  allowAttach = false,
  onAttach,
  onViewDocuments,
  onAddChild,
  onEdit,
  onDelete,
  navigationPath = [],
  expandedIds,
  onToggleExpand,
  autoScrollToTarget = true,
  highlightId = null,
  reloadBranchId = null,
  onBranchReloaded,
  rootsHasMore = false,
  rootsTotal = 0,
  onLoadMoreRoots,
  loadingMoreRoots = false,
  filterAccess = false,
}) {
  if (!data?.length) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium">Aucune localité dans le plan de classement</p>
        <p className="text-sm text-gray-400 mt-1">
          {readOnly
            ? "Le référentiel de classement est vide pour le moment."
            : "Commencez par ajouter un élément racine"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {data.map((node, index) => (
        <TreeNode
          key={node.id}
          node={node}
          siblingIndex={index + 1}
          readOnly={readOnly}
          filterAccess={filterAccess}
          allowAttach={allowAttach}
          onAttach={onAttach}
          onViewDocuments={onViewDocuments}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          navigationPath={navigationPath}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          autoScrollToTarget={autoScrollToTarget}
          highlightId={highlightId}
          reloadBranchId={reloadBranchId}
          onBranchReloaded={onBranchReloaded}
        />
      ))}
      {rootsHasMore && (
        <VoirPlusButton
          onClick={onLoadMoreRoots}
          loading={loadingMoreRoots}
          loaded={data.length}
          total={rootsTotal}
        />
      )}
    </div>
  );
}
