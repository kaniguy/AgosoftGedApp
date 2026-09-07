"use client";

import {
  flattenTreeCodenames,
  isHiddenPermissionKey,
  nodeHasVisiblePerm,
  PERMISSION_TREE,
  permKey,
} from "../../constants/permissionTree";

function listHasId(list, id) {
  const n = Number(id);
  return list.some((x) => Number(x) === n);
}

function PermissionNode({
  node,
  depth,
  permByKey,
  visibleKeys,
  selectedIds,
  onToggle,
}) {
  if (!nodeHasVisiblePerm(node, visibleKeys)) return null;

  const perm = node.codename ? permByKey.get(node.codename) : null;
  const showCheckbox = Boolean(perm && visibleKeys.has(node.codename));
  const children = node.children || [];

  return (
    <div className={depth === 0 ? "mb-3" : ""}>
      {showCheckbox ? (
        <label
          className="flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={listHasId(selectedIds, perm.id)}
            onChange={() => onToggle(perm.id)}
          />
          <span>
            <span className="font-medium">{node.label || perm.name}</span>
          </span>
        </label>
      ) : (
        <div
          className={`px-2 py-1.5 ${
            depth === 0
              ? "text-xs font-semibold uppercase tracking-wide text-purple-700 border-b border-purple-100 mb-1"
              : "text-sm font-semibold text-gray-700"
          }`}
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        >
          {node.label}
          {node.hint && (
            <p className="normal-case tracking-normal font-normal text-xs text-gray-500 mt-0.5">
              {node.hint}
            </p>
          )}
        </div>
      )}
      {children.map((child) => (
        <PermissionNode
          key={child.codename || child.id || child.label}
          node={child}
          depth={showCheckbox || node.label ? depth + 1 : depth}
          permByKey={permByKey}
          visibleKeys={visibleKeys}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default function PermissionTreePicker({
  scopedPerms,
  selectedIds,
  onToggle,
}) {
  const permByKey = new Map(scopedPerms.map((p) => [permKey(p), p]));
  const visibleKeys = new Set(scopedPerms.map(permKey));
  const treeCodenames = flattenTreeCodenames();
  const leftover = scopedPerms.filter((p) => {
    const key = permKey(p);
    return !treeCodenames.has(key) && !isHiddenPermissionKey(key);
  });

  return (
    <div className="max-h-[50vh] overflow-y-auto border rounded-lg p-3">
      {scopedPerms.length === 0 ? null : (
        <>
          {PERMISSION_TREE.map((node) => (
            <PermissionNode
              key={node.id || node.codename}
              node={node}
              depth={0}
              permByKey={permByKey}
              visibleKeys={visibleKeys}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
          {leftover.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 py-1.5 mb-1">
                Autres permissions
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {leftover.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={listHasId(selectedIds, p.id)}
                      onChange={() => onToggle(p.id)}
                    />
                    <span>
                      <span className="font-medium">{p.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
