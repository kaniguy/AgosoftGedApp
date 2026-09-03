// Page d'accueil du module : redirige vers le plan de classement (seul menu actif)
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GestionDocumentaireIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/gestion_documentaire/plan_geographique");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        <p className="mt-4 text-slate-500">Chargement du module…</p>
      </div>
    </div>
  );
}
