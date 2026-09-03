"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getVisibleModulesFromStorage } from "../../constants/modules";
import { listGuidesAide } from "../../services/guideAide.service";

export default function AideVideoSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [guides, setGuides] = useState([]);
  const [modules, setModules] = useState([]);

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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const allowedModules = modules.filter(
      (m) => m.code === "general" || allowedCodes.has(m.code)
    );
    return allowedModules.map((mod) => ({
      ...mod,
      items: guides.filter((g) => g.module_code === mod.code),
    }));
  }, [allowedCodes, guides, modules]);

  const activeModule = searchParams.get("module") || "";
  const isCatalog = pathname === "/aide-video";
  const isTousActive = isCatalog && !activeModule;

  return (
    <aside
      className={`
        fixed left-0 top-16 h-screen bg-white/95 backdrop-blur-md border-r border-rose-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          type="button"
          onClick={onToggle}
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-rose-50 transition-all duration-200 border border-rose-200 z-50"
        >
          <svg
            className={`w-3 h-3 text-rose-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-6 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">Aide Vidéo</h2>
              <p className="text-xs text-rose-600 mt-0.5 text-center lg:text-left font-medium">
                Tutoriels & guides
              </p>
            </>
          )}
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto pr-1">
          <Link
            href="/aide-video"
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
              ${isTousActive
                ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-200"
                : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"}
              ${!isOpen && "justify-center"}
            `}
            title={!isOpen ? "Tous les tutoriels" : ""}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {isOpen && <span className="text-sm font-medium">Tous les tutoriels</span>}
          </Link>

          {groups.map((group) => {
            const moduleActive = isCatalog && activeModule === group.code;
            return (
              <div key={group.code} className="pt-2">
                <Link
                  href={`/aide-video?module=${encodeURIComponent(group.code)}`}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150
                    ${moduleActive
                      ? "bg-rose-100 text-rose-800"
                      : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"}
                    ${!isOpen && "justify-center"}
                  `}
                  title={!isOpen ? group.label : ""}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {isOpen && (
                    <span className="text-sm font-medium truncate">{group.label}</span>
                  )}
                </Link>
                {isOpen &&
                  group.items.map((item) => {
                    const active = pathname === `/aide-video/${item.id}`;
                    return (
                      <Link
                        key={item.id}
                        href={`/aide-video/${item.id}`}
                        className={`
                          ml-6 mt-0.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                          ${active
                            ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white"
                            : "text-slate-500 hover:bg-rose-50 hover:text-rose-700"}
                        `}
                      >
                        <span className="truncate">{item.titre}</span>
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
