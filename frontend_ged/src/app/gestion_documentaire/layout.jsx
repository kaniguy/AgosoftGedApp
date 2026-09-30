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
    <div className="min-h-app-screen bg-transparent">
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
