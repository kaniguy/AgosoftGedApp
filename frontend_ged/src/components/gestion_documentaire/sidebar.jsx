// Barre latérale du module Gestion Documentaire (navigation entre les écrans du module)
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canViewGedPlanClassement, hasPermission, PERMISSIONS } from "../../utils/permissions";
import { listAllVisibleBrouillons } from "../../utils/brouillonsList";
import { RATTACHEMENT_DRAFTS_UPDATED } from "../../utils/rattachementDraftStore";

export default function GestionDocumentaireSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const [accessVersion, setAccessVersion] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  const canSeeBrouillons = hasPermission(PERMISSIONS.VIEW_DOCUMENT_LOCALITE);

  useEffect(() => {
    const onAccessUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onAccessUpdate);
    return () => window.removeEventListener("user-profile-updated", onAccessUpdate);
  }, []);

  useEffect(() => {
    if (!canSeeBrouillons) {
      setDraftCount(0);
      return undefined;
    }

    let cancelled = false;
    const loadCount = async () => {
      try {
        const { drafts } = await listAllVisibleBrouillons();
        if (!cancelled) setDraftCount(drafts.length);
      } catch {
        if (!cancelled) setDraftCount(0);
      }
    };

    loadCount();
    const onDraftsUpdated = () => loadCount();
    window.addEventListener(RATTACHEMENT_DRAFTS_UPDATED, onDraftsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(RATTACHEMENT_DRAFTS_UPDATED, onDraftsUpdated);
    };
  }, [canSeeBrouillons, accessVersion]);

  const allMenuItems = [
    
    {
      id: "plan-geographique",
      name: "Plan de classement",
      path: "/gestion_documentaire/plan_geographique",
      permissionCheck: canViewGedPlanClassement,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.757 20.557H6v-8h1.757l3.9-3.9zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },

    {
      id: "documents",
      name: "Liste des documents",
      path: "/gestion_documentaire/documents",
      permission: PERMISSIONS.VIEW_DOCUMENT_LOCALITE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },

    {
      id: "brouillons",
      name: "Liste des brouillons",
      path: "/gestion_documentaire/brouillons",
      permission: PERMISSIONS.VIEW_DOCUMENT_LOCALITE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
    },
  ];

  const menuItems = useMemo(
    () =>
      allMenuItems.filter((item) =>
        item.permissionCheck ? item.permissionCheck() : hasPermission(item.permission)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessVersion]
  );

  // Indique si le lien correspond à la page courante (y compris sous-pages)
  const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

  const getItemLabel = (item) => {
    if (item.id === "brouillons") {
      return `Liste des brouillons (${draftCount})`;
    }
    return item.name;
  };

  return (
    <aside
      className={`
        fixed left-0 top-16 h-app-screen bg-white/95 backdrop-blur-md border-r border-emerald-100 shadow-xl
        transition-all duration-300 ease-in-out z-50
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          onClick={onToggle}
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-emerald-50 transition-all duration-200 border border-emerald-200 z-50 group"
          type="button"
          aria-label="Réduire ou agrandir le menu"
        >
          <svg
            className={`w-3 h-3 text-emerald-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-8 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">
                Gestion Documentaire
              </h2>
              <p className="text-xs text-emerald-600 mt-0.5 text-center lg:text-left font-medium">
                Consultation &amp; archives
              </p>
            </>
          )}
        </div>

        <div className="space-y-1 flex-1">
          {menuItems.map((item) => {
            const active = isActive(item.path);

            return (
              <Link
                key={item.id}
                href={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
                  ${
                    active
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-200"
                      : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }
                  ${!isOpen && "justify-center"}
                `}
                title={!isOpen ? getItemLabel(item) : ""}
              >
                <span
                  className={`relative ${active ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`}
                >
                  {item.icon}
                  {!isOpen && item.id === "brouillons" && draftCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {draftCount > 9 ? "9+" : draftCount}
                    </span>
                  )}
                </span>

                {isOpen && (
                  <>
                    <span className="text-sm font-medium">{getItemLabel(item)}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </>
                )}

                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-emerald-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {getItemLabel(item)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div>
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-emerald-600 font-medium">Module actif</p>
              <p className="text-[9px] text-slate-400 mt-1">v1.0.0</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
