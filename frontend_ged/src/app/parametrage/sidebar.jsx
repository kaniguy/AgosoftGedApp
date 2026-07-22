// app/parametrage/sidebar.jsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

export default function ParametrageSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const [accessVersion, setAccessVersion] = useState(0);

  useEffect(() => {
    const onAccessUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onAccessUpdate);
    return () => window.removeEventListener("user-profile-updated", onAccessUpdate);
  }, []);

  const allMenuItems = [
    {
      id: 'type-document',
      name: 'Types de documents',
      path: '/parametrage/type_document',
      permission: PERMISSIONS.VIEW_TYPE_DOCUMENT,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'champs-document',
      name: 'Champs documents',
      path: '/parametrage/champs_document',
      permission: PERMISSIONS.VIEW_CHAMPS_DOCUMENT,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    },

    {
      id: 'structure-geographique',
      name: 'Structures géographiques',
      path: '/parametrage/structure_geographique',
      permission: PERMISSIONS.VIEW_STRUCTURE_GEOGRAPHIQUE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.757 20.557H6v-8h1.757l3.9-3.9zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },

    {
      id: 'plan-geographique',
      name: 'Plans géographiques',
      path: '/parametrage/plan_geographique',
      permission: PERMISSIONS.VIEW_PLAN_GEOGRAPHIQUE,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.757 20.557H6v-8h1.757l3.9-3.9zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
      
    
  ];

  const menuItems = useMemo(
    () => allMenuItems.filter((item) => hasPermission(item.permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessVersion]
  );

  const isActive = (path) => pathname === path;

  return (
    <aside 
      className={`
        fixed left-0 top-16 h-screen bg-white/95 backdrop-blur-md border-r border-blue-100 shadow-xl
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
        <div className="mb-8 px-3">
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

        {/* Menu items */}
        <div className="space-y-1 flex-1">
          {menuItems.map((item) => {
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
                  ${active 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200' 
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }
                  ${!isOpen && 'justify-center'}
                `}
                title={!isOpen ? item.name : ''}
              >
                <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`}>
                  {item.icon}
                </span>
                
                {isOpen && (
                  <>
                    <span className="text-sm font-medium">{item.name}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </>
                )}

                {/* Tooltip pour version fermée */}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

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