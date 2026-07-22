"use client";

import { useState } from "react";
import GestionAccesSidebar from "./sidebar";

export default function GestionAccesLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
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
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
