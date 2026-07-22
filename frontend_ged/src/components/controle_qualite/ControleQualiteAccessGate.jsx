"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  canAccessControleQualite,
  canViewStatutMenu,
} from "../../utils/controleQualitePermissions";

export default function ControleQualiteAccessDenied() {
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 bg-white rounded-2xl border border-yellow-200 shadow-sm text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-800">Accès refusé</h2>
      <p className="text-sm text-slate-500 mt-2">
        Vous n&apos;avez pas les droits nécessaires pour accéder à cette section du contrôle qualité.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Accueil
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg"
        >
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}

export function ControleQualiteModuleGate({ children }) {
  if (!canAccessControleQualite()) {
    return <ControleQualiteAccessDenied />;
  }
  return children;
}

export function ControleQualiteStatutGate({ statut, children }) {
  if (!canAccessControleQualite() || !canViewStatutMenu(statut)) {
    return <ControleQualiteAccessDenied />;
  }
  return children;
}
