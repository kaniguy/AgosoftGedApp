"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasAnyPermission, hasPermission, PERMISSIONS } from "../../utils/permissions";
import { useAnalytiqueFilters } from "../../hooks/useAnalytiqueFilters";

const menuItems = [
  {
    id: "documents",
    name: "Documents",
    path: "/analytique/documents",
    permission: PERMISSIONS.VIEW_DOCUMENT_LOCALITE,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "administration",
    name: "Utilisateurs",
    path: "/analytique/administration",
    permissionCheck: () =>
      hasAnyPermission([PERMISSIONS.VIEW_USER, PERMISSIONS.VIEW_GROUP]),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function AnalytiqueSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const { buildUrl, activeFilterCount } = useAnalytiqueFilters();

  const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);
  const visibleItems = menuItems.filter((item) =>
    item.permissionCheck ? item.permissionCheck() : hasPermission(item.permission)
  );

  return (
    <aside
      className={`
        fixed left-0 top-16 h-screen bg-white/95 backdrop-blur-md border-r border-orange-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          onClick={onToggle}
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-orange-50 transition-all duration-200 border border-orange-200 z-50"
        >
          <svg
            className={`w-3 h-3 text-orange-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-8 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>

          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">
                Analytique & Rapports
              </h2>
              <p className="text-xs text-orange-600 mt-0.5 text-center lg:text-left font-medium">
                Documents & utilisateurs
              </p>
              {activeFilterCount > 0 && (
                <p className="text-[10px] text-orange-500 mt-1 text-center lg:text-left">
                  {activeFilterCount} filtre(s) actif(s) — conservés entre vues
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                href={buildUrl(item.path)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
                  ${
                    active
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200"
                      : "text-slate-600 hover:bg-orange-50 hover:text-orange-700"
                  }
                  ${!isOpen && "justify-center"}
                `}
                title={!isOpen ? item.name : ""}
              >
                <span className={`${active ? "text-white" : "text-slate-500 group-hover:text-orange-600"}`}>
                  {item.icon}
                </span>

                {isOpen && (
                  <>
                    <span className="font-medium text-sm">{item.name}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </>
                )}

                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-orange-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div>
          <div className="h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-orange-600 font-medium">Filtres synchronisés</p>
              <p className="text-[9px] text-slate-400 mt-1">Navigation croisée</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-orange-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
