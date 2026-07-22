"use client";

import { useEffect, useState } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "../../../services/user.service";
import { getGroups } from "../../../services/group.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";

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

export default function UtilisateursPage() {
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

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const load = async () => {
    try {
      setLoading(true);
      const [usersData, groupsData] = await Promise.all([getUsers(), getGroups()]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

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
      groups: user.groups || [],
    });
    setModal("form");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (selected && !payload.password) delete payload.password;
      if (selected) await updateUser(selected.id, payload);
      else await createUser(payload);
      setModal(null);
      showNotif(selected ? "Utilisateur modifié" : "Utilisateur créé");
      await load();
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(selected.id);
      setModal(null);
      showNotif("Utilisateur supprimé");
      await load();
    } catch (err) {
      showNotif(err.message, "error");
    }
  };

  const toggleGroup = (groupId) => {
    setForm((prev) => ({
      ...prev,
      groups: prev.groups.includes(groupId)
        ? prev.groups.filter((id) => id !== groupId)
        : [...prev.groups, groupId],
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

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
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
                  <tr key={user.id} className="border-b hover:bg-gray-50">
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
                    </td>
                    {showRowActions && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
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
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {selected ? "Nouveau mot de passe (optionnel)" : "Mot de passe *"}
                </label>
                <input
                  type="password"
                  required={!selected}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
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
                        <input type="checkbox" checked={form.groups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                        {g.name}
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
    </div>
  );
}
