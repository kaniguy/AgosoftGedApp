// Layout du module Gestion Documentaire : sidebar + zone de contenu principale
"use client";

import { useState } from "react";
import GestionDocumentaireSidebar from "../../components/gestion_documentaire/sidebar";

export default function GestionDocumentaireLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Bascule l'ouverture / fermeture de la barre latérale
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="flex pt-16">
        <GestionDocumentaireSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

        <main
          className={`
            transition-all duration-300 ease-in-out flex-1 min-w-0 overflow-x-hidden
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
