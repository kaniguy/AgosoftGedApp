"use client";

import { Suspense, useState } from "react";
import GestionAccesSidebar from "./sidebar";

export default function GestionAccesLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="flex pt-16">
        <GestionAccesSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main
          className={`
            transition-all duration-300 ease-in-out flex-1
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="p-6">
            <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
