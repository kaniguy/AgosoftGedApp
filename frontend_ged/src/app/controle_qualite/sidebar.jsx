"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CONTROLE_QUALITE_STATUTS } from "../../constants/controleQualiteMenu";
import { getLocalitesDernierNiveau } from "../../services/group.service";
import {
  canAccessControleQualite,
  canViewStatutMenu,
} from "../../utils/controleQualitePermissions";
import { CONTROLE_QUALITE_STATS_UPDATED } from "../../utils/controleQualiteStats";

const FILTER_ACCESS = true;

const STATUT_ICONS = {
  en_attente: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rejete: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  valide: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function ControleQualiteSidebarNav({ isOpen }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [totaux, setTotaux] = useState({});

  const loadTotaux = useCallback(async () => {
    if (!canAccessControleQualite()) {
      setTotaux({});
      return;
    }
    try {
      const { totauxParStatut } = await getLocalitesDernierNiveau("", FILTER_ACCESS, {
        totauxSeulement: true,
      });
      setTotaux(totauxParStatut || {});
    } catch {
      setTotaux({});
    }
  }, []);

  useEffect(() => {
    loadTotaux();
  }, [loadTotaux, pathname]);

  useEffect(() => {
    const onFocus = () => loadTotaux();
    const onStatsUpdated = () => loadTotaux();
    window.addEventListener("focus", onFocus);
    window.addEventListener(CONTROLE_QUALITE_STATS_UPDATED, onStatsUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CONTROLE_QUALITE_STATS_UPDATED, onStatsUpdated);
    };
  }, [loadTotaux]);

  const validationStatut = pathname.startsWith("/controle_qualite/validation/")
    ? searchParams.get("statut")
    : null;
  const contextStatut = validationStatut;

  const isStatutActive = (statutId, path) => {
    if (pathname === path || pathname.startsWith(`${path}/`)) return true;
    if (
      contextStatut === statutId &&
      pathname.startsWith("/controle_qualite/validation/")
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-1 flex-1 overflow-y-auto">
      {CONTROLE_QUALITE_STATUTS.filter((item) => canViewStatutMenu(item.id)).map((item) => {
        const active = isStatutActive(item.id, item.path);
        const count = totaux[item.id] ?? 0;

        return (
          <Link
            key={item.id}
            href={item.path}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
              ${
                active
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md shadow-yellow-200"
                  : "text-slate-600 hover:bg-yellow-50 hover:text-yellow-700"
              }
              ${!isOpen && "justify-center"}
            `}
            title={!isOpen ? item.label : ""}
          >
            <span className={`${active ? "text-white" : "text-slate-500 group-hover:text-yellow-600"}`}>
              {STATUT_ICONS[item.id]}
            </span>

            {isOpen && (
              <>
                <span className="text-sm font-medium leading-tight flex-1 min-w-0">{item.shortLabel}</span>
                <span
                  className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shrink-0 ${
                    active ? "bg-white/20 text-white" : item.badgeClass
                  }`}
                >
                  {count}
                </span>
              </>
            )}

            {!isOpen && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                {item.label} ({count})
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default function ControleQualiteSidebar({ isOpen, onToggle }) {
  return (
    <aside
      className={`
        fixed left-0 top-16 h-app-screen bg-white/95 backdrop-blur-md border-r border-yellow-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          onClick={onToggle}
          type="button"
          aria-label="Réduire ou agrandir le menu"
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-yellow-50 transition-all duration-200 border border-yellow-200 z-50"
        >
          <svg
            className={`w-3 h-3 text-yellow-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-6 px-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-700 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">Contrôle qualité</h2>
              <p className="text-xs text-yellow-600 mt-0.5 text-center lg:text-left font-medium">
                Par statut documentaire
              </p>
            </>
          )}
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <ControleQualiteSidebarNav isOpen={isOpen} />
        </Suspense>

        <div className="shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-yellow-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-yellow-600 font-medium">1 site = 1 localité</p>
              <p className="text-[9px] text-slate-400 mt-1">Dernier niveau géo</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-yellow-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
