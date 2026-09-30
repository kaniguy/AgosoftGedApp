// Liste globale des documents avec filtres
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import DocumentListeGlobale from "../../../components/gestion_documentaire/documents/DocumentListeGlobale";

export default function DocumentsGlobauxPage() {
  const router = useRouter();
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  return (
    <div className="min-h-[calc(100*var(--app-vh)-8rem)] -mx-2 min-w-0 max-w-full overflow-x-hidden">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-fade-in">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-xl shadow-xl text-white flex items-center gap-3 ${
              notification.type === "error"
                ? "bg-gradient-to-r from-red-500 to-rose-600"
                : "bg-gradient-to-r from-emerald-500 to-teal-600"
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="mb-5">
        <nav className="text-sm flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-slate-500 hover:text-emerald-600 transition cursor-pointer"
          >
            Accueil
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => router.push("/gestion_documentaire/plan_geographique")}
            className="text-slate-500 hover:text-emerald-600 transition cursor-pointer"
          >
            Gestion documentaire
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-semibold">Liste des documents</span>
        </nav>
      </div>

      <DocumentListeGlobale onNotify={showNotification} />
    </div>
  );
}
