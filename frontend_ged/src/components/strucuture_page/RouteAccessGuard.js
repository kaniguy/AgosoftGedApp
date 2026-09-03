"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPath } from "../../constants/routeAccess";

export default function RouteAccessGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessVersion, setAccessVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setAccessVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onUpdate);
    return () => window.removeEventListener("user-profile-updated", onUpdate);
  }, []);

  if (accessVersion >= 0 && canAccessPath(pathname)) {
    return children;
  }

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        Vous n’avez pas le droit d’accéder à cette page. Contactez un administrateur si besoin.
      </p>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-6 px-4 py-2 text-sm text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
      >
        Retour à l’accueil
      </button>
    </div>
  );
}
