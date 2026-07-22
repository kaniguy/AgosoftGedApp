"use client";

import { useEffect, useState } from "react";
import { getPermissions } from "../../../services/permission.service";

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPermissions();
        setPermissions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const apps = [...new Set(permissions.map((p) => p.app_label))].sort();

  const getAppLabel = (perm) => perm.app_label_display || perm.app_label;
  const getModelLabel = (perm) => perm.model_display || perm.model;

  const filtered = permissions.filter((p) => {
    const matchSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.codename?.toLowerCase().includes(search.toLowerCase()) ||
      p.model?.toLowerCase().includes(search.toLowerCase()) ||
      getAppLabel(p).toLowerCase().includes(search.toLowerCase()) ||
      getModelLabel(p).toLowerCase().includes(search.toLowerCase());
    const matchApp = appFilter === "all" || p.app_label === appFilter;
    return matchSearch && matchApp;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Permissions natives Django (lecture seule) — assignez-les via les groupes ou les utilisateurs
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Liste ({filtered.length})</h2>
          <div className="flex gap-3">
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="all">Toutes les applications</option>
              {apps.map((app) => {
                const sample = permissions.find((p) => p.app_label === app);
                const label = sample?.app_label_display || app;
                return (
                <option key={app} value={app}>{label}</option>
                );
              })}
            </select>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-64 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : (
          <div className="overflow-auto max-h-[500px] border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Permission</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Application</th>
                  <th className="px-4 py-3 text-left">Modèle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((perm) => (
                  <tr key={perm.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{perm.name}</td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">{perm.codename}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{getAppLabel(perm)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getModelLabel(perm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
