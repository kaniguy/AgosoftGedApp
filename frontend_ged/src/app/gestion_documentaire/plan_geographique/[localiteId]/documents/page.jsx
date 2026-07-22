// Liste des documents rattachés à une localité (filtre, colonnes, aperçu)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getPlanGeographique } from "../../../../../services/planGeographique.service";
import DocumentListePanel from "../../../../../components/gestion_documentaire/documents/DocumentListePanel";
import { PLAN_GEO_RESTORE_PATH } from "../../../../../components/gestion_documentaire/plan_geographique/planGeoNavigationState";

export default function DocumentsLocalitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const localiteId = params?.localiteId;
  const updatedHandledRef = useRef(false);

  const [localite, setLocalite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const loadLocalite = useCallback(async () => {
    if (!localiteId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getPlanGeographique(localiteId);
      if (data?.can_add_child) {
        setError("Seul le dernier niveau géographique possède des documents.");
        setLocalite(null);
        return;
      }
      setLocalite(data);
    } catch (err) {
      setError(err.message || "Localité introuvable");
      setLocalite(null);
    } finally {
      setLoading(false);
    }
  }, [localiteId]);

  useEffect(() => {
    loadLocalite();
  }, [loadLocalite]);

  useEffect(() => {
    if (updatedHandledRef.current) return;
    if (searchParams.get("updated") !== "1") return;
    updatedHandledRef.current = true;
    showNotification("Document modifié avec succès", "success");
    router.replace(`/gestion_documentaire/plan_geographique/${localiteId}/documents`, { scroll: false });
  }, [searchParams, localiteId, router, showNotification]);

  const goToPlan = () => {
    router.push(PLAN_GEO_RESTORE_PATH);
  };

  const goToAttach = () => {
    router.push(`/gestion_documentaire/plan_geographique/${localiteId}/rattacher`);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] -mx-2">
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
          <button type="button" onClick={() => router.push("/")} className="text-slate-500 hover:text-emerald-600 transition cursor-pointer">
            Accueil
          </button>
          <span className="text-slate-300">/</span>
          <button type="button" onClick={goToPlan} className="text-slate-500 hover:text-emerald-600 transition cursor-pointer">
            Plan géographique
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-semibold">Documents</span>
        </nav>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            <p className="mt-4 text-gray-500">Chargement…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={goToPlan}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 cursor-pointer"
          >
            Retour au plan géographique
          </button>
        </div>
      )}

      {!loading && localite && (
        <DocumentListePanel
          localite={localite}
          onClose={goToPlan}
          onAttach={goToAttach}
          onNotify={showNotification}
        />
      )}
    </div>
  );
}
