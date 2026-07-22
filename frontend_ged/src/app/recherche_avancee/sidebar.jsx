"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, PERMISSIONS } from "../../utils/permissions";

export default function RechercheAvanceeSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const [accessVersion, setAccessVersion] = useState(0);

  useEffect(() => {
    const onAccessUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onAccessUpdate);
    return () => window.removeEventListener("user-profile-updated", onAccessUpdate);
  }, []);

  const allMenuItems = [
    {
      id: "recherche-documents",
      name: "Recherche documents",
      path: "/recherche_avancee",
      permission: PERMISSIONS.VIEW_DOCUMENT_LOCALITE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
  ];

  const menuItems = useMemo(
    () => allMenuItems.filter((item) => hasPermission(item.permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessVersion]
  );

  const isActive = (path) =>
    pathname === path || (path !== "/recherche_avancee" && pathname.startsWith(`${path}/`));

  return (
    <aside
      className={`
        fixed left-0 top-16 h-screen bg-white/95 backdrop-blur-md border-r border-cyan-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          onClick={onToggle}
          type="button"
          aria-label="Réduire ou agrandir le menu"
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-cyan-50 transition-all duration-200 border border-cyan-200 z-50"
        >
          <svg
            className={`w-3 h-3 text-cyan-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-8 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-sky-700 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">
                Recherche Avancée
              </h2>
              <p className="text-xs text-cyan-600 mt-0.5 text-center lg:text-left font-medium">
                Filtres &amp; exploration
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
                      ? "bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-200"
                      : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
                  }
                  ${!isOpen && "justify-center"}
                `}
                title={!isOpen ? item.name : ""}
              >
                <span className={`${active ? "text-white" : "text-slate-500 group-hover:text-cyan-600"}`}>
                  {item.icon}
                </span>

                {isOpen && (
                  <>
                    <span className="text-sm font-medium">{item.name}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </>
                )}

                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-cyan-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div>
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-cyan-600 font-medium">Recherche multi-critères</p>
              <p className="text-[9px] text-slate-400 mt-1">Filtres par colonne</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-cyan-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
