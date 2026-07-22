/**
 * Page de paramétrage des zones de capture pour un type de document.
 * Route : /parametrage/champs_document/[typeDocumentId]/zones
 * Permet d'encadrer visuellement chaque champ sur le document modèle (style Dokmee Capture).
 */
"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import CaptureZoneEditor from "@/components/parametrage/capture/CaptureZoneEditor";

/**
 * Affiche l'éditeur de zones de capture pour le type de document donné.
 */
export default function CaptureZonesPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const typeDocumentId = resolvedParams.typeDocumentId;
  const [notification, setNotification] = useState(null);

  /**
   * Affiche une notification temporaire en haut de page.
   */
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  /**
   * Retourne à la liste des champs document.
   */
  const handleBack = () => {
    router.push("/parametrage/champs_document");
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      {notification && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            notification.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : notification.type === "info"
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}
        >
          {notification.message}
        </div>
      )}

      <CaptureZoneEditor
        typeDocumentId={typeDocumentId}
        onNotify={showNotification}
        onBack={handleBack}
      />
    </div>
  );
}
