"use client";

import { useState } from "react";
import RechercheAvanceeSidebar from "./sidebar";

export default function RechercheAvanceeLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-app-screen bg-transparent">
      <div className="flex pt-16">
        <RechercheAvanceeSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main
          className={`
            transition-all duration-300 ease-in-out flex-1
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="px-4 pb-4 pt-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
