"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, hasAnyPermission, PERMISSIONS } from "../../utils/permissions";

export default function GestionAccesSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const [accessVersion, setAccessVersion] = useState(0);
  const [emailGroupOpen, setEmailGroupOpen] = useState(false);

  useEffect(() => {
    const onAccessUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onAccessUpdate);
    return () => window.removeEventListener("user-profile-updated", onAccessUpdate);
  }, []);

  const itemIsVisible = (item) =>
    item.permissionCheck ? item.permissionCheck() : hasPermission(item.permission);

  const menuItems = [
    {
      id: "utilisateurs",
      name: "Utilisateurs",
      path: "/gestion_acces/utilisateurs",
      permission: PERMISSIONS.VIEW_USER,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: "groupes",
      name: "Groupes",
      path: "/gestion_acces/groupes",
      permission: PERMISSIONS.VIEW_GROUP,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "permissions",
      name: "Permissions",
      path: "/gestion_acces/permissions",
      permission: PERMISSIONS.VIEW_PERMISSION,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: "liens-telechargement",
      name: "Liens de téléchargement",
      path: "/gestion_acces/liens-telechargement",
      permission: PERMISSIONS.VIEW_LIEN_TELECHARGEMENT,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: "journal-activite",
      name: "Journal d'activité",
      path: "/gestion_acces/journal-activite",
      permission: PERMISSIONS.VIEW_JOURNAL_ACTIVITE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "entreprise",
      name: "Entreprise",
      path: "/gestion_acces/entreprise",
      permissionCheck: () =>
        hasAnyPermission([PERMISSIONS.VIEW_ENTREPRISE, PERMISSIONS.CHANGE_ENTREPRISE]),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: "profil",
      name: "Mon profil",
      path: "/gestion_acces/profil",
      permission: null,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const emailMenuGroup = {
    id: "emails-notifications",
    name: "E-mails & notifications",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    children: [
      {
        id: "configuration-email",
        name: "Configuration SMTP-MAIL",
        path: "/gestion_acces/configuration-email",
        permissionCheck: () =>
          hasAnyPermission([
            PERMISSIONS.VIEW_CONFIGURATION_EMAIL,
            PERMISSIONS.CHANGE_CONFIGURATION_EMAIL,
          ]),
      },
      {
        id: "notifications",
        name: "Notifications",
        path: "/gestion_acces/notifications",
        permissionCheck: () =>
          hasAnyPermission([
            PERMISSIONS.VIEW_REGLE_NOTIFICATION,
            PERMISSIONS.CHANGE_REGLE_NOTIFICATION,
          ]),
      },
      {
        id: "mes-notifications",
        name: "Mes notifications",
        path: "/gestion_acces/mes-notifications",
        permission: null,
      },
    ],
  };

  const visibleMenuItems = useMemo(() => {
    const beforeProfil = menuItems.slice(0, -1).filter(itemIsVisible);
    const profil = menuItems.at(-1);
    const profilVisible = profil && itemIsVisible(profil) ? [profil] : [];
    const emailChildren = emailMenuGroup.children.filter(itemIsVisible);

    return {
      beforeProfil,
      emailGroup: emailChildren.length > 0 ? { ...emailMenuGroup, children: emailChildren } : null,
      profil: profilVisible,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessVersion]);

  const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

  const emailGroupIsActive = useMemo(
    () =>
      visibleMenuItems.emailGroup?.children.some((child) => isActive(child.path)) ?? false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, visibleMenuItems.emailGroup]
  );

  useEffect(() => {
    if (emailGroupIsActive) {
      setEmailGroupOpen(true);
    }
  }, [emailGroupIsActive]);

  const renderMenuLink = (item, { submenu = false } = {}) => {
    const active = isActive(item.path);

    return (
      <Link
        key={item.id}
        href={item.path}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
          ${
            active
              ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-200"
              : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
          }
          ${!isOpen && "justify-center"}
          ${submenu && isOpen ? "ml-3 pl-4 border-l-2 border-purple-100" : ""}
        `}
        title={!isOpen ? item.name : ""}
      >
        {item.icon && (
          <span className={`${active ? "text-white" : "text-slate-500 group-hover:text-purple-600"}`}>
            {item.icon}
          </span>
        )}

        {isOpen && (
          <>
            <span className={`font-medium ${submenu ? "text-xs" : "text-sm"}`}>{item.name}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </>
        )}

        {!isOpen && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`
        fixed left-0 top-16 h-screen bg-white/95 backdrop-blur-md border-r border-purple-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? "w-64" : "w-20"}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        <button
          onClick={onToggle}
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-purple-50 transition-all duration-200 border border-purple-200 z-50"
        >
          <svg
            className={`w-3 h-3 text-purple-600 transition-transform duration-300 ${!isOpen && "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-8 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">
                Gestion des accès
              </h2>
              <p className="text-xs text-purple-600 mt-0.5 text-center lg:text-left font-medium">
                Utilisateurs &amp; sécurité
              </p>
            </>
          )}
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto">
          {visibleMenuItems.beforeProfil.map((item) => renderMenuLink(item))}

          {visibleMenuItems.emailGroup && (
            <div className="pt-3">
              {isOpen ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEmailGroupOpen((open) => !open)}
                    className={`w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg transition-colors ${
                      emailGroupIsActive
                        ? "bg-purple-50 text-purple-800"
                        : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                    aria-expanded={emailGroupOpen}
                  >
                    <span className="text-purple-600 shrink-0">
                      {visibleMenuItems.emailGroup.icon}
                    </span>
                    <span className="text-sm font-semibold leading-tight text-left flex-1">
                      {visibleMenuItems.emailGroup.name}
                    </span>
                    <svg
                      className={`w-4 h-4 shrink-0 text-purple-500 transition-transform duration-200 ${
                        emailGroupOpen ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  {emailGroupOpen &&
                    visibleMenuItems.emailGroup.children.map((child) =>
                      renderMenuLink(child, { submenu: true })
                    )}
                </>
              ) : (
                <div className="relative group flex justify-center py-2">
                  <span className="text-purple-600">{visibleMenuItems.emailGroup.icon}</span>
                  <div className="absolute left-full ml-2 py-2 px-1 bg-white border border-purple-100 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50 min-w-[12rem]">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600">
                      {visibleMenuItems.emailGroup.name}
                    </p>
                    {visibleMenuItems.emailGroup.children.map((child) => (
                      <Link
                        key={child.id}
                        href={child.path}
                        className={`block px-3 py-2 text-xs rounded-md mx-1 ${
                          isActive(child.path)
                            ? "bg-purple-600 text-white"
                            : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                        }`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {visibleMenuItems.profil.map((item) => renderMenuLink(item))}
        </div>

        <div>
          <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-purple-600 font-medium">Sécurité active</p>
              <p className="text-[9px] text-slate-400 mt-1">Django Auth</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-purple-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
