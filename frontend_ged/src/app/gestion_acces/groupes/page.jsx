"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getGroups,
  createGroup,
  updateGroup,
  patchGroup,
  deleteGroup,
  getAppModules,
  getLocalitesDernierNiveau,
} from "../../../services/group.service";
import { getPermissions } from "../../../services/permission.service";
import { getUsers } from "../../../services/user.service";
import { getTypeDocuments } from "../../../services/typeDocument.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";
import EmptyListState from "../../../components/ui/EmptyListState";
import PermissionTreePicker from "../../../components/gestion_acces/PermissionTreePicker";
import {
  expandPermissionIds,
  isHiddenPermissionKey,
  permKey,
  removePermissionKeysCascade,
  togglePermissionCascade,
} from "../../../constants/permissionTree";

const emptyForm = {
  name: "",
  modules: [],
  permissions: [],
  types_documents: [],
  users: [],
  localites: [],
};

const STEPS = [
  { id: "modules", number: 1, label: "Modules" },
  { id: "permissions", number: 2, label: "Permissions" },
  { id: "types_documents", number: 3, label: "Types de document" },
  { id: "utilisateurs", number: 4, label: "Utilisateurs" },
  { id: "localites", number: 5, label: "Localités" },
];

/** Une permission appartient au module via son app (hors exclusions) ou via la liste des extras. */
function isPermissionInModule(perm, mod) {
  const full = `${perm.app_label}.${perm.codename}`;
  if ((mod.extra_permission_codenames || []).includes(full)) return true;
  return (
    (mod.app_labels || []).includes(perm.app_label) &&
    !(mod.excluded_permission_codenames || []).includes(full)
  );
}

function toIdList(values) {
  return (values || []).map((v) => Number(v)).filter((n) => Number.isFinite(n));
}

function listHasId(list, id) {
  const n = Number(id);
  return list.some((x) => Number(x) === n);
}

function getStepCount(stepId, form) {
  switch (stepId) {
    case "modules":
      return form.modules.length;
    case "permissions":
      return form.permissions.length;
    case "types_documents":
      return form.types_documents.length;
    case "utilisateurs":
      return form.users.length;
    case "localites":
      return form.localites.length;
    default:
      return 0;
  }
}

function SelectAllActions({ onSelectAll, onDeselectAll }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onSelectAll}
        title="Tout cocher"
        className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-50 transition cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDeselectAll}
        title="Tout décocher"
        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </button>
    </div>
  );
}

/** Affiche une notification temporaire en haut à droite. */
function useNotification() {
  const [notification, setNotification] = useState(null);

  const showNotif = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  return { notification, showNotif };
}

export default function GroupesPage() {
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.GROUP);
  const showRowActions = canChange || canDelete;
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [appModules, setAppModules] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allTypeDocuments, setAllTypeDocuments] = useState([]);
  const [localitesFeuilles, setLocalitesFeuilles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("general");
  const [permSearch, setPermSearch] = useState("");
  const [typeDocSearch, setTypeDocSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [locSearch, setLocSearch] = useState("");
  const [loadingLocalites, setLoadingLocalites] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { notification, showNotif } = useNotification();

  /** Permissions des modules cochés, puis filtre texte. */
  const filteredPerms = useMemo(
    () => {
      const selected = appModules.filter((m) => form.modules.includes(m.code));
      const hasScope = selected.some(
        (m) => (m.app_labels || []).length > 0 || (m.extra_permission_codenames || []).length > 0
      );
      const scoped = !hasScope
        ? permissions
        : permissions.filter((p) => selected.some((m) => isPermissionInModule(p, m)));
      const visible = scoped.filter((p) => !isHiddenPermissionKey(permKey(p)));
      const q = permSearch.toLowerCase();
      if (!q) return visible;
      return visible.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.codename?.toLowerCase().includes(q) ||
          p.app_label?.toLowerCase().includes(q)
      );
    },
    [appModules, form.modules, permSearch, permissions]
  );

  /** Utilisateurs filtrés par la recherche textuelle. */
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

  /** Types de document filtrés par la recherche textuelle. */
  const filteredTypeDocuments = useMemo(() => {
    const q = typeDocSearch.toLowerCase();
    if (!q) return allTypeDocuments;
    return allTypeDocuments.filter(
      (td) =>
        td.libelle?.toLowerCase().includes(q) ||
        td.code?.toLowerCase().includes(q) ||
        td.description?.toLowerCase().includes(q)
    );
  }, [allTypeDocuments, typeDocSearch]);

  /** Charge groupes, permissions, modules, types de document et utilisateurs. */
  const load = async () => {
    try {
      setLoading(true);
      const [groupsData, permsData, modulesData, usersData, typesData] = await Promise.all([
        getGroups(),
        getPermissions(),
        getAppModules(),
        getUsers(),
        getTypeDocuments(),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setPermissions(Array.isArray(permsData) ? permsData : []);
      setAppModules(Array.isArray(modulesData) ? modulesData : []);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
      setAllTypeDocuments(Array.isArray(typesData) ? typesData : []);
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  /** Charge les localités du dernier niveau pour le sélecteur du modal. */
  const loadLocalites = async (query = "") => {
    try {
      setLoadingLocalites(true);
      const data = await getLocalitesDernierNiveau(query);
      setLocalitesFeuilles(data.results || []);
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoadingLocalites(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (modal === "form" && activeTab === "localites") {
      const timer = setTimeout(() => loadLocalites(locSearch), 300);
      return () => clearTimeout(timer);
    }
  }, [modal, activeTab, locSearch]);

  const filtered = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  /** Ouvre le modal de création avec formulaire vide. */
  const openCreate = () => {
    setForm(emptyForm);
    setSelected(null);
    setActiveTab("general");
    setPermSearch("");
    setTypeDocSearch("");
    setUserSearch("");
    setLocSearch("");
    setModal("form");
  };

  /** Ouvre le modal de modification avec les données du groupe. */
  const openEdit = (group) => {
    setSelected(group);
    setForm({
      name: group.name,
      modules: group.modules || [],
      permissions: toIdList(group.permissions),
      types_documents: toIdList(group.types_documents),
      users: toIdList(group.users),
      localites: toIdList(group.localites),
    });
    setActiveTab("general");
    setPermSearch("");
    setTypeDocSearch("");
    setUserSearch("");
    setLocSearch("");
    setModal("form");
  };

  /** Enregistre le groupe (création ou mise à jour). */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.modules.length) {
      showNotif("Sélectionnez au moins un module avant d'enregistrer.", "error");
      setActiveTab("modules");
      return;
    }
    try {
      const saved = selected
        ? await updateGroup(selected.id, form)
        : await createGroup(form);
      setGroups((prev) => {
        if (!saved?.id) return prev;
        const index = prev.findIndex((g) => g.id === saved.id);
        if (index === -1) return [...prev, saved];
        const next = [...prev];
        next[index] = { ...prev[index], ...saved };
        return next;
      });
      setModal(null);
      showNotif(selected ? "Groupe modifié" : "Groupe créé");
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  /** Supprime le groupe sélectionné. */
  const handleDelete = async () => {
    try {
      const deletedId = selected.id;
      await deleteGroup(deletedId);
      setGroups((prev) => prev.filter((g) => g.id !== deletedId));
      setModal(null);
      showNotif("Groupe supprimé");
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  const handleToggleActive = async (group, nextActive) => {
    try {
      setBusyId(group.id);
      const saved = await patchGroup(group.id, { is_active: nextActive });
      setGroups((prev) =>
        prev.map((g) => (Number(g.id) === Number(saved.id) ? { ...g, ...saved } : g))
      );
      const active = saved.is_active !== false;
      if (active !== nextActive) {
        showNotif("Le statut du groupe n'a pas pu être mis à jour.", "error");
        return;
      }
      showNotif(active ? "Groupe activé" : "Groupe désactivé");
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  /** Ajoute ou retire une permission, avec cascade des prérequis / dépendants. */
  const togglePermission = (permId) => {
    setForm((prev) => ({
      ...prev,
      permissions: togglePermissionCascade(prev.permissions, permId, permissions),
    }));
  };

  const viewIdsForModule = (mod) => {
    const defaults = new Set(mod.default_permission_codenames || []);
    return permissions
      .filter(
        (p) =>
          defaults.has(permKey(p)) ||
          (isPermissionInModule(p, mod) && String(p.codename || "").startsWith("view_"))
      )
      .map((p) => Number(p.id));
  };

  /** Ajoute ou retire un module. */
  const toggleModule = (code) => {
    setForm((prev) => {
      const adding = !prev.modules.includes(code);
      const modules = adding
        ? [...prev.modules, code]
        : prev.modules.filter((c) => c !== code);
      const mod = appModules.find((m) => m.code === code);
      const viewIds = mod ? viewIdsForModule(mod) : [];
      const nextPermissions = adding
        ? expandPermissionIds([...prev.permissions, ...viewIds], permissions)
        : prev.permissions.filter((id) => !viewIds.includes(Number(id)));
      return { ...prev, modules, permissions: nextPermissions };
    });
  };

  /** Ajoute ou retire un utilisateur membre du groupe. */
  const toggleUser = (userId) => {
    const id = Number(userId);
    setForm((prev) => ({
      ...prev,
      users: listHasId(prev.users, id)
        ? prev.users.filter((x) => Number(x) !== id)
        : [...prev.users, id],
    }));
  };

  /** Ajoute ou retire un type de document du formulaire. */
  const toggleTypeDocument = (typeId) => {
    const id = Number(typeId);
    setForm((prev) => ({
      ...prev,
      types_documents: listHasId(prev.types_documents, id)
        ? prev.types_documents.filter((x) => Number(x) !== id)
        : [...prev.types_documents, id],
    }));
  };

  /** Ajoute ou retire une localité feuille du formulaire. */
  const toggleLocalite = (locId) => {
    const id = Number(locId);
    setForm((prev) => ({
      ...prev,
      localites: listHasId(prev.localites, id)
        ? prev.localites.filter((x) => Number(x) !== id)
        : [...prev.localites, id],
    }));
  };

  const selectAllModules = () => {
    const viewIds = appModules.flatMap((mod) => viewIdsForModule(mod));
    setForm((prev) => ({
      ...prev,
      modules: appModules.map((mod) => mod.code),
      permissions: expandPermissionIds([...prev.permissions, ...viewIds], permissions),
    }));
  };

  const deselectAllModules = () => {
    setForm((prev) => ({ ...prev, modules: [] }));
  };

  const selectAllFilteredPermissions = () => {
    const ids = filteredPerms.map((p) => Number(p.id));
    setForm((prev) => ({
      ...prev,
      permissions: expandPermissionIds([...prev.permissions, ...ids], permissions),
    }));
  };

  const deselectAllFilteredPermissions = () => {
    const keys = filteredPerms.map((p) => permKey(p));
    setForm((prev) => ({
      ...prev,
      permissions: removePermissionKeysCascade(prev.permissions, keys, permissions),
    }));
  };

  const selectAllFilteredUsers = () => {
    const ids = filteredUsers.map((u) => u.id);
    setForm((prev) => ({
      ...prev,
      users: [...new Set([...prev.users, ...ids])],
    }));
  };

  const deselectAllFilteredUsers = () => {
    const ids = new Set(filteredUsers.map((u) => u.id));
    setForm((prev) => ({
      ...prev,
      users: prev.users.filter((id) => !ids.has(id)),
    }));
  };

  const selectAllFilteredTypeDocuments = () => {
    const ids = filteredTypeDocuments.map((td) => td.id);
    setForm((prev) => ({
      ...prev,
      types_documents: [...new Set([...prev.types_documents, ...ids])],
    }));
  };

  const deselectAllFilteredTypeDocuments = () => {
    const ids = new Set(filteredTypeDocuments.map((td) => td.id));
    setForm((prev) => ({
      ...prev,
      types_documents: prev.types_documents.filter((id) => !ids.has(id)),
    }));
  };

  const selectAllVisibleLocalites = () => {
    const ids = localitesFeuilles.map((loc) => loc.id);
    setForm((prev) => ({
      ...prev,
      localites: [...new Set([...prev.localites, ...ids])],
    }));
  };

  const deselectAllVisibleLocalites = () => {
    const ids = new Set(localitesFeuilles.map((loc) => loc.id));
    setForm((prev) => ({
      ...prev,
      localites: prev.localites.filter((id) => !ids.has(id)),
    }));
  };

  return (
    <div>
      {notification && (
        <div
          className={`fixed top-20 right-5 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${
            notification.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Groupes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Modules, permissions, types de document, utilisateurs et localités
          </p>
        </div>
        {canAdd && (
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
        >
          <span>+</span> Ajouter
        </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">Liste ({filtered.length})</h2>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg w-64 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : filtered.length === 0 ? (
          <EmptyListState
            icon="users"
            tone="purple"
            title={search ? "Aucun groupe trouvé" : "Aucun groupe"}
            description={
              search
                ? "Aucun groupe ne correspond à votre recherche."
                : "Créez un groupe pour attribuer des modules, permissions et localités."
            }
          />
        ) : (
          <div className="overflow-auto max-h-[500px] border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left">Modules</th>
                  <th className="px-4 py-3 text-left">Membres</th>
                  <th className="px-4 py-3 text-left">Types doc.</th>
                  <th className="px-4 py-3 text-left">Localités</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  {showRowActions && (
                  <th className="px-4 py-3 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => (
                  <tr key={group.id} className={`border-b hover:bg-gray-50 ${group.is_active === false ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3 font-medium">{group.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(group.modules || []).map((code) => (
                          <span
                            key={code}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                          >
                            {code}
                          </span>
                        ))}
                        {(!group.modules || group.modules.length === 0) && (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700 font-medium">
                        {group.users_count ?? (group.users || []).length} utilisateur(s)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">
                        {(group.types_documents || []).length > 0
                          ? `${(group.types_documents || []).length} type(s)`
                          : "Tous"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">
                        {(group.localites || []).length} localité(s)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${group.is_active === false ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {group.is_active === false ? "Inactif" : "Actif"}
                      </span>
                    </td>
                    {showRowActions && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center flex-wrap gap-1">
                        {canChange && (
                        <button
                          type="button"
                          disabled={busyId === group.id || group.is_active !== false}
                          onClick={() => handleToggleActive(group, true)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Activer
                        </button>
                        )}
                        {canChange && (
                        <button
                          type="button"
                          disabled={busyId === group.id || group.is_active === false}
                          onClick={() => handleToggleActive(group, false)}
                          className="px-3 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 disabled:opacity-40"
                        >
                          Désactiver
                        </button>
                        )}
                        {canChange && (
                        <button
                          onClick={() => openEdit(group)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Modifier
                        </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => {
                            setSelected(group);
                            setModal("delete");
                          }}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                        )}
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "form" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[calc(88*var(--app-vh))] flex flex-col shadow-2xl">
            <div className="bg-purple-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-semibold">
                  {selected ? "Modifier le groupe" : "Nouveau groupe"}
                </h3>
                <p className="text-purple-200 text-xs mt-0.5">
                  Configurez le groupe étape par étape
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-2xl leading-none hover:text-purple-200"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center border-b border-gray-200 px-4 py-3 gap-3 shrink-0 bg-gray-50/80">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition whitespace-nowrap shrink-0 ${
                  activeTab === "general"
                    ? "border-purple-600 bg-purple-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-700"
                }`}
              >
                Général
              </button>

              <div className="hidden sm:block w-px h-8 bg-gray-200 shrink-0" />

              <div className="flex flex-1 items-center gap-1 overflow-x-auto min-w-0 pb-0.5 sm:pb-0">
                {STEPS.map((step, index) => {
                  const isActive = activeTab === step.id;
                  const count = getStepCount(step.id, form);
                  return (
                    <div key={step.id} className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab(step.id)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                          isActive
                            ? "bg-purple-100 text-purple-800 ring-2 ring-purple-500 ring-offset-1"
                            : "text-gray-600 hover:bg-white hover:text-purple-700"
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                            isActive
                              ? "bg-purple-600 text-white"
                              : count > 0
                                ? "bg-purple-200 text-purple-800"
                                : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {step.number}
                        </span>
                        <span>{step.label}</span>
                        {count > 0 && (
                          <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                            {count}
                          </span>
                        )}
                      </button>
                      {index < STEPS.length - 1 && (
                        <svg
                          className="w-4 h-4 text-gray-300 mx-0.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "general" && (
                  <div className="max-w-lg">
                    <label className="text-sm font-medium text-gray-700">Nom du groupe *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="Ex: Agents terrain, Administrateurs..."
                    />
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                      Commencez par l&apos;onglet <strong>Modules</strong>, puis les{" "}
                      <strong>Permissions</strong>, les <strong>Types de document</strong>, les{" "}
                      <strong>Utilisateurs</strong> et enfin les localités du dernier niveau.
                    </p>
                  </div>
                )}

                {activeTab === "modules" && (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <p className="text-sm text-gray-600 flex-1">
                        Choisissez les modules visibles. Les droits de consultation associés
                        sont cochés automatiquement (vous pourrez les ajuster à l’étape Permissions).
                      </p>
                      <SelectAllActions
                        onSelectAll={selectAllModules}
                        onDeselectAll={deselectAllModules}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {appModules.map((mod) => (
                        <label
                          key={mod.code}
                          className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${
                            form.modules.includes(mod.code)
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-purple-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={form.modules.includes(mod.code)}
                            onChange={() => toggleModule(mod.code)}
                          />
                          <span>
                            <span className="font-semibold text-gray-800 block">{mod.label}</span>
                            <span className="text-xs text-gray-500">{mod.description}</span>
                            {(mod.app_labels || []).length > 0 && (
                              <span className="text-[10px] text-purple-600 block mt-1">
                                Apps : {mod.app_labels.join(", ")}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "permissions" && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Les droits sont liés en arbre : autoriser l’import de documents coche
                      aussi la consultation, les types, les champs et le plan de classement.
                      Décocher un prérequis retire les actions qui en dépendent.
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Filtrer les permissions..."
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      />
                      <SelectAllActions
                        onSelectAll={selectAllFilteredPermissions}
                        onDeselectAll={deselectAllFilteredPermissions}
                      />
                    </div>
                    {filteredPerms.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6 border rounded-lg">
                        {form.modules.length === 0
                          ? "Cochez au moins un module pour afficher ses permissions."
                          : "Aucune permission trouvée."}
                      </p>
                    ) : (
                      <PermissionTreePicker
                        scopedPerms={filteredPerms}
                        selectedIds={form.permissions}
                        onToggle={togglePermission}
                      />
                    )}
                  </div>
                )}

                {activeTab === "types_documents" && (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm text-gray-600 flex-1">
                        Restreignez les types de documents visibles pour ce groupe (
                        {form.types_documents.length} sélectionné(s)). Laissez vide pour autoriser{" "}
                        <strong>tous</strong> les types.
                      </p>
                      <SelectAllActions
                        onSelectAll={selectAllFilteredTypeDocuments}
                        onDeselectAll={deselectAllFilteredTypeDocuments}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher un type de document..."
                      value={typeDocSearch}
                      onChange={(e) => setTypeDocSearch(e.target.value)}
                      className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
                    />
                    {form.types_documents.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {form.types_documents.map((id) => {
                          const td =
                            allTypeDocuments.find((item) => item.id === id) ||
                            (selected?.types_documents_detail || []).find((item) => item.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs"
                            >
                              {td?.libelle || td?.code || `ID ${id}`}
                              <button
                                type="button"
                                onClick={() => toggleTypeDocument(id)}
                                className="text-amber-600 hover:text-red-600"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="max-h-[calc(50*var(--app-vh))] overflow-y-auto border rounded-lg divide-y">
                      {filteredTypeDocuments.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500 text-center">
                          Aucun type de document trouvé.
                        </p>
                      ) : (
                        filteredTypeDocuments.map((td) => (
                          <label
                            key={td.id}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={listHasId(form.types_documents, td.id)}
                              onChange={() => toggleTypeDocument(td.id)}
                            />
                            <span>
                              <span className="font-medium text-gray-800">{td.libelle}</span>
                              {td.code && (
                                <span className="ml-2 text-xs text-gray-400">({td.code})</span>
                              )}
                              {td.description && (
                                <span className="block text-xs text-gray-500 mt-0.5">
                                  {td.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "utilisateurs" && (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm text-gray-600 flex-1">
                        Sélectionnez les utilisateurs membres de ce groupe ({form.users.length}{" "}
                        sélectionné(s)).
                      </p>
                      <SelectAllActions
                        onSelectAll={selectAllFilteredUsers}
                        onDeselectAll={deselectAllFilteredUsers}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher un utilisateur..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
                    />
                    {form.users.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {form.users.map((id) => {
                          const u =
                            allUsers.find((item) => item.id === id) ||
                            (selected?.users_detail || []).find((item) => item.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                            >
                              {u?.username || `ID ${id}`}
                              <button
                                type="button"
                                onClick={() => toggleUser(id)}
                                className="text-blue-600 hover:text-red-600"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="max-h-[calc(50*var(--app-vh))] overflow-y-auto border rounded-lg divide-y">
                      {filteredUsers.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500 text-center">
                          Aucun utilisateur trouvé.
                        </p>
                      ) : (
                        filteredUsers.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={listHasId(form.users, u.id)}
                              onChange={() => toggleUser(u.id)}
                            />
                            <span className="flex-1">
                              <span className="font-medium text-gray-800">{u.username}</span>
                              <span className="block text-xs text-gray-500">
                                {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                                  u.email ||
                                  "—"}
                              </span>
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                u.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {u.is_active ? "Actif" : "Inactif"}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "localites" && (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm text-gray-600 flex-1">
                        Localités du <strong>dernier niveau</strong> : l&apos;utilisateur verra
                        l&apos;arborescence déroulée de la racine jusqu&apos;à sa localité.
                      </p>
                      <SelectAllActions
                        onSelectAll={selectAllVisibleLocalites}
                        onDeselectAll={deselectAllVisibleLocalites}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher un site (libellé ou code)..."
                      value={locSearch}
                      onChange={(e) => setLocSearch(e.target.value)}
                      className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
                    />
                    {form.localites.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {form.localites.map((id) => {
                          const loc =
                            localitesFeuilles.find((l) => l.id === id) ||
                            (selected?.localites_detail || []).find((l) => l.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs"
                            >
                              {loc?.chemin_str || loc?.libelle || `ID ${id}`}
                              <button
                                type="button"
                                onClick={() => toggleLocalite(id)}
                                className="text-emerald-600 hover:text-red-600"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {loadingLocalites ? (
                      <p className="text-center py-8 text-gray-500">Chargement des localités...</p>
                    ) : (
                      <div className="max-h-[calc(50*var(--app-vh))] overflow-y-auto border rounded-lg divide-y">
                        {localitesFeuilles.length === 0 ? (
                          <p className="p-4 text-sm text-gray-500 text-center">
                            Aucune localité au dernier niveau trouvée.
                          </p>
                        ) : (
                          localitesFeuilles.map((loc) => (
                            <label
                              key={loc.id}
                              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={listHasId(form.localites, loc.id)}
                                onChange={() => toggleLocalite(loc.id)}
                              />
                              <span>
                                <span className="font-medium text-gray-800">{loc.libelle}</span>
                                {loc.code && (
                                  <span className="ml-2 text-xs text-gray-400">({loc.code})</span>
                                )}
                                <span className="block text-xs text-emerald-700 mt-0.5">
                                  {loc.chemin_str}
                                </span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t rounded-b-xl flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "delete" && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-lg">
              <h3 className="font-semibold">Confirmer la suppression</h3>
            </div>
            <div className="p-6">
              <p>
                Supprimer le groupe <strong>{selected.name}</strong> ?
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">
                Annuler
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
