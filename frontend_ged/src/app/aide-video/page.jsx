"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getVisibleModulesFromStorage } from "../../constants/modules";
import { listGuidesAide } from "../../services/guideAide.service";

function AideVideoCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("module") || "all";
  const [search, setSearch] = useState("");
  const [guides, setGuides] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const allowedCodes = useMemo(() => {
    const visible = getVisibleModulesFromStorage();
    return new Set(visible.map((m) => m.code));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listGuidesAide()
      .then((data) => {
        if (cancelled) return;
        setGuides(data.results || []);
        setModules(data.modules || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Chargement impossible.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const moduleLabel = useMemo(() => {
    const map = Object.fromEntries(modules.map((m) => [m.code, m.label]));
    return (code) => map[code] || code;
  }, [modules]);

  const tutoriels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guides.filter((item) => {
      if (item.module_code && item.module_code !== "general" && !allowedCodes.has(item.module_code)) {
        return false;
      }
      if (category !== "all" && item.module_code !== category) return false;
      if (!q) return true;
      return (
        item.titre.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
      );
    });
  }, [allowedCodes, category, guides, search]);

  return (
    <div className="w-full min-w-0">
      <nav className="text-sm flex flex-wrap items-center gap-1.5 mb-6">
        <button type="button" onClick={() => router.push("/")} className="text-slate-500 hover:text-rose-600">
          Accueil
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-rose-700 font-semibold">Aide Vidéo</span>
        {category !== "all" && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">{moduleLabel(category)}</span>
          </>
        )}
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Aide Vidéo</h1>
        <p className="text-slate-500 mt-1">
          Tutoriels, documents et assistance pas à pas pour chaque module.
        </p>
      </div>

      <div className="w-full min-w-0 mb-8">
        <div className="relative w-full min-w-0">
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un tutoriel…"
            className="block w-full min-w-0 pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-100 outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-slate-500">Chargement des guides…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && tutoriels.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 font-medium">Aucun tutoriel publié</p>
          <p className="text-slate-400 text-sm mt-1">
            Les guides sont gérés par le superutilisateur dans Gestion des accès → Aide Vidéo.
          </p>
        </div>
      )}

      {!loading && tutoriels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tutoriels.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(`/aide-video/${item.id}`)}
              className="text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-rose-200 transition group"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-semibold text-slate-800 group-hover:text-rose-700">{item.titre}</h2>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                <span>{item.module_libelle}</span>
                <span>
                  {(item.etapes || []).length} étapes
                  {(item.documents || []).length ? ` · ${item.documents.length} doc.` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AideVideoPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
      <AideVideoCatalog />
    </Suspense>
  );
}
