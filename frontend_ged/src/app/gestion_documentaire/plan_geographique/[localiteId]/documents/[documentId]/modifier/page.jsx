// Page dédiée à la modification d'un document (même layout que le rattachement)
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlanGeographique } from "@/services/planGeographique.service";
import { getDocumentLocalite } from "@/services/documentLocalite.service";
import DocumentRattachementPanel from "@/components/gestion_documentaire/documents/DocumentRattachementPanel";
import { PLAN_GEO_RESTORE_PATH } from "@/components/gestion_documentaire/plan_geographique/planGeoNavigationState";

export default function ModifierDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const localiteId = params?.localiteId;
  const documentId = params?.documentId;

  const [localite, setLocalite] = useState(null);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const loadData = useCallback(async () => {
    if (!localiteId || !documentId) return;
    try {
      setLoading(true);
      setError(null);
      const [loc, doc] = await Promise.all([
        getPlanGeographique(localiteId),
        getDocumentLocalite(documentId),
      ]);

      if (loc?.can_add_child) {
        setError("Seul le dernier niveau géographique possède des documents.");
        setLocalite(null);
        setDocument(null);
        return;
      }

      if (Number(doc.localite) !== Number(localiteId)) {
        setError("Ce document n'appartient pas à cette localité.");
        setLocalite(null);
        setDocument(null);
        return;
      }

      setLocalite(loc);
      setDocument(doc);
    } catch (err) {
      setError(err.message || "Impossible de charger le document");
      setLocalite(null);
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [localiteId, documentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToList = () => {
    router.push(`/gestion_documentaire/plan_geographique/${localiteId}/documents`);
  };

  const handleSaved = () => {
    router.push(
      `/gestion_documentaire/plan_geographique/${localiteId}/documents?updated=1`
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] -mx-2 min-h-0">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999]">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg text-white ${
              notification.type === "error"
                ? "bg-red-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-600"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      <div className="mb-4 shrink-0">
        <nav className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => router.push("/")} className="hover:text-emerald-600 cursor-pointer">
            Accueil
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => router.push(PLAN_GEO_RESTORE_PATH)}
            className="hover:text-emerald-600 cursor-pointer"
          >
            Plan géographique
          </button>
          <span>/</span>
          <button type="button" onClick={goToList} className="hover:text-emerald-600 cursor-pointer">
            Documents
          </button>
          <span>/</span>
          <span className="text-gray-700 font-medium">Modifier</span>
        </nav>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            <p className="mt-4 text-gray-500">Chargement du document…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={goToList}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 cursor-pointer"
          >
            Retour à la liste
          </button>
        </div>
      )}

      {!loading && localite && document && (
        <div className="flex-1 min-h-0 flex flex-col">
          <DocumentRattachementPanel
            localite={localite}
            documentToEdit={document}
            fullPage
            onClose={goToList}
            onSaved={handleSaved}
            onNotify={showNotification}
          />
        </div>
      )}
    </div>
  );
}
