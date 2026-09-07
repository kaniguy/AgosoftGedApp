"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsers, createUser, updateUser, patchUser, deleteUser } from "../../../services/user.service";
import { getGroups } from "../../../services/group.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";
import EmptyListState from "../../../components/ui/EmptyListState";
import { PASSWORD_HELP, passwordComplexityMessage } from "../../../utils/passwordPolicy";

const emptyForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  is_active: true,
  is_staff: false,
  is_superuser: false,
  groups: [],
};

function toIdList(values) {
  return (values || []).map((v) => Number(v)).filter((n) => Number.isFinite(n));
}

function listHasId(list, id) {
  const n = Number(id);
  return list.some((x) => Number(x) === n);
}

const ETAT_LABELS = {
  total: "Tous les utilisateurs",
  actifs: "Comptes actifs",
  inactifs: "Comptes inactifs",
  jamais_connectes: "Jamais connectés",
  sans_groupe: "Sans groupe",
  connectes_30j: "Connectés (30 j)",
  nouveaux_30j: "Nouveaux (30 j)",
};

function msAgo(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function currentUserId() {
  try {
    return Number(JSON.parse(localStorage.getItem("user") || "{}")?.id);
  } catch {
    return NaN;
  }
}

function matchesEtat(user, etat, mois) {
  if (mois) {
    if (!user.date_joined) return false;
    const d = new Date(user.date_joined);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key !== mois) return false;
    if (!etat || etat === "nouveaux_30j") return true;
  }
  if (!etat || etat === "total") return true;
  if (etat === "actifs") return Boolean(user.is_active);
  if (etat === "inactifs") return !user.is_active;
  if (etat === "jamais_connectes") return !user.last_login;
  if (etat === "sans_groupe") {
    const groups = user.groups_detail || user.groups || [];
    return groups.length === 0;
  }
  if (etat === "connectes_30j") {
    return Boolean(user.last_login) && new Date(user.last_login).getTime() >= msAgo(30);
  }
  if (etat === "nouveaux_30j") {
    return Boolean(user.date_joined) && new Date(user.date_joined).getTime() >= msAgo(30);
  }
  return true;
}

export default function UtilisateursPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.USER);
  const showRowActions = canChange || canDelete;
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState(null);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [delivery, setDelivery] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const openedUserFromQuery = useRef(false);

  const etatFilter = searchParams.get("etat") || "";
  const groupeFilter = searchParams.get("groupe") || "";
  const moisFilter = searchParams.get("mois") || "";
  const userFilter = searchParams.get("user") || "";

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const load = async () => {
    try {
      setLoading(true);
      const [usersData, groupsData] = await Promise.all([
        getUsers(),
        getGroups({ lite: true }),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const upsertUser = (saved) => {
    if (!saved?.id) return;
    setUsers((prev) => {
      const index = prev.findIndex((u) => u.id === saved.id);
      if (index === -1) return [...prev, saved];
      const next = [...prev];
      next[index] = { ...prev[index], ...saved };
      return next;
    });
  };

  useEffect(() => {
    load();
  }, []);

  const clearQueryFilters = () => {
    router.replace("/gestion_acces/utilisateurs");
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (!matchesEtat(u, etatFilter, moisFilter)) return false;
      if (groupeFilter) {
        const id = Number(groupeFilter);
        const inDetail = (u.groups_detail || []).some((g) => Number(g.id) === id);
        const inIds = (u.groups || []).some((g) => Number(g) === id);
        if (!inDetail && !inIds) return false;
      }
      if (!q) return true;
      return (
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q)
      );
    });
  }, [users, search, etatFilter, groupeFilter, moisFilter]);

  const groupeLabel = groups.find((g) => String(g.id) === String(groupeFilter))?.name;

  const openCreate = () => {
    setForm(emptyForm);
    setSelected(null);
    setModal("form");
  };

  const openEdit = (user) => {
    setSelected(user);
    setForm({
      username: user.username,
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      password: "",
      is_active: user.is_active,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
      groups: toIdList(user.groups),
    });
    setModal("form");
  };

  useEffect(() => {
    if (openedUserFromQuery.current || !userFilter || !users.length) return;
    const found = users.find((u) => String(u.id) === String(userFilter));
    if (found) {
      openedUserFromQuery.current = true;
      openEdit(found);
    }
  }, [userFilter, users]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      else {
        const complexity = passwordComplexityMessage(payload.password);
        if (complexity) {
          showNotif(complexity, "error");
          return;
        }
      }
      if (selected) {
        const saved = await updateUser(selected.id, payload);
        upsertUser(saved);
        setModal(null);
        showNotif("Utilisateur modifié");
      } else {
        const created = await createUser(payload);
        upsertUser(created);
        setModal(null);
        setDelivery({
          username: created.username || payload.username,
          detail: created.password_delivery_detail || "Utilisateur créé.",
          password: created.generated_password || "",
          status: created.password_delivery || "ok",
        });
      }
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  const handleDelete = async () => {
    try {
      const deletedId = selected.id;
      await deleteUser(deletedId);
      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
      setModal(null);
      showNotif("Utilisateur supprimé");
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  const handleToggleActive = async (user) => {
    if (Number(user.id) === currentUserId() && user.is_active) {
      showNotif("Vous ne pouvez pas désactiver votre propre compte.", "error");
      return;
    }
    try {
      setBusyId(user.id);
      const saved = await patchUser(user.id, { is_active: !user.is_active });
      upsertUser(saved);
      showNotif(saved.is_active ? "Utilisateur activé" : "Utilisateur désactivé");
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleGroup = (groupId) => {
    const id = Number(groupId);
    setForm((prev) => ({
      ...prev,
      groups: listHasId(prev.groups, id)
        ? prev.groups.filter((x) => Number(x) !== id)
        : [...prev.groups, id],
    }));
  };

  return (
    <div>
      {notification && (
        <div className={`fixed top-20 right-5 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${notification.type === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des comptes utilisateurs Django</p>
        </div>
        {canAdd && (
        <button onClick={openCreate} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2">
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

        {(etatFilter || groupeFilter || moisFilter) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-800">
            <span className="font-medium">Filtre analytique :</span>
            {etatFilter && <span>{ETAT_LABELS[etatFilter] || etatFilter}</span>}
            {moisFilter && <span>Mois {moisFilter}</span>}
            {groupeFilter && <span>Groupe {groupeLabel || `#${groupeFilter}`}</span>}
            <button
              type="button"
              onClick={clearQueryFilters}
              className="ml-auto text-purple-700 hover:underline"
            >
              Effacer
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : filtered.length === 0 ? (
          <EmptyListState
            icon="users"
            tone="purple"
            title={search || etatFilter || groupeFilter || moisFilter ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
            description={
              search || etatFilter || groupeFilter || moisFilter
                ? "Aucun compte ne correspond aux filtres ou à la recherche."
                : "Créez un compte pour commencer à donner des accès à l'application."
            }
          />
        ) : (
          <div className="overflow-auto max-h-[500px] border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Groupes</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  {showRowActions && (
                  <th className="px-4 py-3 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className={`border-b hover:bg-gray-50 ${user.is_active ? "" : "opacity-70"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.first_name} {user.last_name}</div>
                    </td>
                    <td className="px-4 py-3">{user.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(user.groups_detail || []).map((g) => (
                          <span key={g.id} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{g.name}</span>
                        ))}
                        {(!user.groups_detail || user.groups_detail.length === 0) && <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {user.is_active ? "Actif" : "Inactif"}
                      </span>
                      {user.is_staff && <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Staff</span>}
                      {user.has_usable_password === false && (
                        <span className="ml-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">Sans mot de passe</span>
                      )}
                    </td>
                    {showRowActions && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center flex-wrap gap-1">
                        {canChange && (
                        <button
                          type="button"
                          disabled={busyId === user.id || user.is_active}
                          onClick={() => handleToggleActive(user)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Activer
                        </button>
                        )}
                        {canChange && (
                        <button
                          type="button"
                          disabled={busyId === user.id || !user.is_active || Number(user.id) === currentUserId()}
                          onClick={() => handleToggleActive(user)}
                          className="px-3 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 disabled:opacity-40"
                        >
                          Désactiver
                        </button>
                        )}
                        {canChange && (
                        <button onClick={() => openEdit(user)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Modifier</button>
                        )}
                        {canDelete && (
                        <button onClick={() => { setSelected(user); setModal("delete"); }} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Supprimer</button>
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
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 text-white px-6 py-3 rounded-t-lg flex justify-between">
              <h3 className="font-semibold">{selected ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</h3>
              <button onClick={() => setModal(null)} className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nom d'utilisateur *</label>
                <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" disabled={!!selected} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Prénom</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                {!selected && (
                  <p className="mt-1 text-xs text-gray-500">
                    Nécessaire pour envoyer automatiquement un mot de passe généré (si le SMTP est configuré).
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {selected
                    ? selected.has_usable_password === false
                      ? "Mot de passe (requis pour que le compte puisse se connecter)"
                      : "Nouveau mot de passe (optionnel)"
                    : "Mot de passe (optionnel)"}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {selected
                    ? PASSWORD_HELP
                    : `Laissez vide pour générer et envoyer un mot de passe par e-mail si le SMTP est configuré et que la règle « Envoi du mot de passe » est activée. Un mot de passe saisi ici n'envoie aucun e-mail. Sinon aucun mot de passe ne sera défini. ${PASSWORD_HELP}`}
                </p>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Actif</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} /> Staff</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_superuser} onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })} /> Superuser</label>
              </div>
              {groups.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Groupes</label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={listHasId(form.groups, g.id)} onChange={() => toggleGroup(g.id)} />
                        {g.name}
                        {g.is_active === false && (
                          <span className="text-xs text-amber-700">(désactivé)</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "delete" && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-lg"><h3 className="font-semibold">Confirmer la suppression</h3></div>
            <div className="p-6">
              <p>Supprimer l'utilisateur <strong>{selected.username}</strong> ?</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {delivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className={`text-white px-6 py-3 rounded-t-lg ${delivery.status === "email_failed" || delivery.status === "unset" ? "bg-amber-600" : "bg-purple-600"}`}>
              <h3 className="font-semibold">Compte {delivery.username}</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700">{delivery.detail}</p>
              {delivery.password && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Mot de passe généré</p>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm break-all">{delivery.password}</code>
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border rounded-lg hover:bg-slate-50"
                      onClick={() => navigator.clipboard?.writeText(delivery.password)}
                    >
                      Copier
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-700">Transmettez-le à l’utilisateur : il ne sera plus affiché.</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button type="button" onClick={() => setDelivery(null)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
