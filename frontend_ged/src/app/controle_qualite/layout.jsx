"use client";

import { useState } from "react";
import ControleQualiteSidebar from "./sidebar";
import { ControleQualiteModuleGate } from "../../components/controle_qualite/ControleQualiteAccessGate";

export default function ControleQualiteLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-app-screen bg-transparent">
      <div className="flex pt-16">
        <ControleQualiteSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main
          className={`
            transition-all duration-300 ease-in-out flex-1 min-w-0 overflow-x-hidden
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="p-6">
            <ControleQualiteModuleGate>{children}</ControleQualiteModuleGate>
          </div>
        </main>
      </div>
    </div>
  );
}
