"use client";

import { Suspense, useState } from "react";
import AideVideoSidebar from "./sidebar";

function AideVideoLayoutInner({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-app-screen bg-transparent">
      <div className="flex pt-16">
        <AideVideoSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((open) => !open)}
        />
        <main
          className={`
            transition-all duration-300 ease-in-out flex-1 min-w-0
            ${isSidebarOpen ? "ml-64" : "ml-20"}
          `}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AideVideoLayout({ children }) {
  return (
    <Suspense fallback={<div className="min-h-app-screen pt-16 p-6 text-slate-500">Chargement…</div>}>
      <AideVideoLayoutInner>{children}</AideVideoLayoutInner>
    </Suspense>
  );
}
