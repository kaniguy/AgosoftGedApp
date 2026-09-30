// Module Recherche Avancée — interface 3 panneaux (types / critères / résultats)
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import RechercheAvanceeWorkbench from "../../components/recherche_avancee/RechercheAvanceeWorkbench";

export default function RechercheAvanceePage() {
  const router = useRouter();
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  return (
    <div className="min-h-[calc(100*var(--app-vh)-6.5rem)] -mx-1 -mt-1 min-w-0 max-w-full overflow-x-hidden flex flex-col">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-fade-in">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-xl shadow-xl text-white flex items-center gap-3 ${
              notification.type === "error"
                ? "bg-gradient-to-r from-red-500 to-rose-600"
                : "bg-gradient-to-r from-cyan-500 to-sky-600"
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <nav className="text-sm flex flex-wrap items-center gap-1.5 mb-2 shrink-0 leading-tight">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-cyan-600 transition cursor-pointer"
        >
          Accueil
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-cyan-700 font-semibold">Recherche avancée</span>
      </nav>

      <RechercheAvanceeWorkbench onNotify={showNotification} />
    </div>
  );
}
