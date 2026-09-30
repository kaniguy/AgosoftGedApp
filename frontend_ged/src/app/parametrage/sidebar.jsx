// app/parametrage/sidebar.jsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PARAMETRAGE_SECTIONS,
  getMissingPrerequisite,
  isParametrageItemVisible,
  isPathInItem,
} from '../../constants/parametrageMenu';

const ICONS = {
  map: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  mail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  database: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
};

const LockIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CheckIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

export default function ParametrageSidebar({ isOpen, onToggle, etat = null }) {
  const pathname = usePathname();
  const [accessVersion, setAccessVersion] = useState(0);
  const [openSections, setOpenSections] = useState({ geographique: true, documentaire: true });

  useEffect(() => {
    const onAccessUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onAccessUpdate);
    return () => window.removeEventListener("user-profile-updated", onAccessUpdate);
  }, []);

  const sections = useMemo(
    () =>
      PARAMETRAGE_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(isParametrageItemVisible),
      })).filter((section) => section.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessVersion]
  );

  const activeSectionId = useMemo(
    () => sections.find((s) => s.items.some((it) => isPathInItem(pathname, it)))?.id ?? null,
    [sections, pathname]
  );

  useEffect(() => {
    if (activeSectionId) {
      setOpenSections((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
    }
  }, [activeSectionId]);

  const toggleSection = (id) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const itemDone = (item) => Boolean(item.countKey && etat && Number(etat[item.countKey]) > 0);

  const renderItem = (item) => {
    const active = isPathInItem(pathname, item);
    const missing = getMissingPrerequisite(item, etat);
    const done = itemDone(item);
    const label = item.name;

    if (missing) {
      return (
        <div
          key={item.id}
          className="flex items-center gap-2 ml-3 pl-4 pr-2 py-2 border-l-2 border-slate-100 rounded-r-lg text-slate-400 cursor-not-allowed"
          title={missing.message}
        >
          <span className="text-xs font-medium flex-1">{label}</span>
          <LockIcon />
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.path}
        className={`flex items-center gap-2 ml-3 pl-4 pr-2 py-2 border-l-2 rounded-r-lg transition-all duration-150 ${
          active
            ? 'border-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200'
            : 'border-blue-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
        }`}
      >
        <span className="text-xs font-medium flex-1">{label}</span>
        {done && (
          <span className={active ? 'text-white' : 'text-emerald-600'} title="Étape réalisée">
            <CheckIcon />
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside 
      className={`
        fixed left-0 top-16 h-app-screen bg-white/95 backdrop-blur-md border-r border-blue-100 shadow-xl
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? 'w-64' : 'w-20'}
      `}
    >
      <div className="py-8 px-4 h-full flex flex-col relative">
        {/* Bouton toggle */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-8 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-blue-50 transition-all duration-200 border border-blue-200 z-50 group"
        >
          <svg 
            className={`w-3 h-3 text-blue-600 transition-transform duration-300 ${!isOpen && 'rotate-180'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Logo section */}
        <div className="mb-6 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg mb-3 flex items-center justify-center mx-auto lg:mx-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          {isOpen && (
            <>
              <h2 className="font-semibold text-slate-800 text-sm text-center lg:text-left">
                Paramétrage
              </h2>
              <p className="text-xs text-blue-600 mt-0.5 text-center lg:text-left font-medium">
                Configuration système
              </p>
            </>
          )}
        </div>

        {/* Menus */}
        <nav className="flex-1 overflow-y-auto pb-24 space-y-1">
          {sections.map((section) => {
            const sectionActive = section.id === activeSectionId;
            const expanded = Boolean(openSections[section.id]);

            if (!isOpen) {
              return (
                <div key={section.id} className="relative group flex justify-center py-2">
                  <span
                    className={`p-2 rounded-lg ${
                      sectionActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 group-hover:text-blue-600'
                    }`}
                  >
                    {ICONS[section.icon]}
                  </span>
                  <div className="absolute left-full top-0 ml-2 py-2 px-1 bg-white border border-blue-100 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50 min-w-[14rem]">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      const missing = getMissingPrerequisite(item, etat);
                      const label = item.name;
                      return missing ? (
                        <span
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                          title={missing.message}
                        >
                          {label}
                          <LockIcon />
                        </span>
                      ) : (
                        <Link
                          key={item.id}
                          href={item.path}
                          className={`block px-3 py-2 text-xs rounded-md mx-1 ${
                            isPathInItem(pathname, item)
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expanded}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    sectionActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <span className="text-blue-600 shrink-0">{ICONS[section.icon]}</span>
                  <span className="text-sm font-semibold leading-tight text-left flex-1">
                    {section.label}
                  </span>
                  <svg
                    className={`w-4 h-4 shrink-0 text-blue-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {expanded && <div className="mt-1 mb-2 space-y-1">{section.items.map(renderItem)}</div>}
              </div>
            );
          })}
        </nav>

        {/* Footer info */}
        <div>
          <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent my-4" />
          {isOpen ? (
            <div className="text-center">
              <p className="text-[10px] text-blue-600 font-medium">⚡ Module actif</p>
              <p className="text-[9px] text-slate-400 mt-1">v1.0.0</p>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
