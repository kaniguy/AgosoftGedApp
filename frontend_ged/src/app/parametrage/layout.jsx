// app/parametrage/layout.jsx
"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ParametrageSidebar from './sidebar';
import useEtatParametrage from '../../hooks/useEtatParametrage';
import { findParametrageItem, getMissingPrerequisite } from '../../constants/parametrageMenu';

function LockedStep({ item, missing }) {
  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-amber-200 rounded-2xl shadow-sm p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-800">
        Étape verrouillée : {item.name}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{missing.message}</p>
      <Link
        href={missing.path}
        className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        Aller à « {missing.label} »
      </Link>
    </div>
  );
}

export default function ParametrageLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();
  const etat = useEtatParametrage(pathname);

  const current = findParametrageItem(pathname);
  const missing = current ? getMissingPrerequisite(current.item, etat) : null;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-app-screen bg-transparent">
      <div className="flex pt-16">
        <ParametrageSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} etat={etat} />
        
        <main 
          className={`
            transition-all duration-300 ease-in-out flex-1
            ${isSidebarOpen ? 'ml-64' : 'ml-20'}
          `}
        >
          <div className="p-6">
            {missing ? (
              <LockedStep item={current.item} missing={missing} />
            ) : (
              <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>{children}</Suspense>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
