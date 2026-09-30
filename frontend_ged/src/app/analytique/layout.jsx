"use client";

import { Suspense, useState } from "react";
import AnalytiqueSidebar from "./sidebar";
import { AnalytiqueFiltersProvider } from "../../hooks/useAnalytiqueFilters";
import "./analytique-print.css";

function AnalytiqueLayoutInner({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-app-screen bg-transparent analytique-module">
      <div className="flex pt-16 print:pt-0">
        <div className="no-print">
          <AnalytiqueSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>

        <main
          className={`
            transition-all duration-300 ease-in-out flex-1
            print:ml-0 print:w-full
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="p-6 print:p-4" id="analytique-report">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AnalytiqueLayout({ children }) {
  return (
    <Suspense fallback={<div className="min-h-app-screen pt-16 p-6 text-slate-500">Chargement…</div>}>
      <AnalytiqueFiltersProvider>
        <AnalytiqueLayoutInner>{children}</AnalytiqueLayoutInner>
      </AnalytiqueFiltersProvider>
    </Suspense>
  );
}
