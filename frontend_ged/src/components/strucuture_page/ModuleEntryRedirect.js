"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getModuleEntryPath } from "../../constants/routeAccess";
import { refreshUserAccess } from "../../services/auth.service";

/** Redirige vers la première page autorisée du module, sinon affiche un message. */
export default function ModuleEntryRedirect({ moduleCode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      await refreshUserAccess();
      if (cancelled) return;
      const path = getModuleEntryPath(moduleCode);
      if (path && path !== pathname) {
        router.replace(path);
        return;
      }
      setEmpty(!path || path === pathname);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [moduleCode, pathname, router]);

  if (!empty) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto" />
          <p className="mt-4 text-slate-500">Chargement du module…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8 p-8 bg-white rounded-2xl border border-slate-200 text-center">
      <h2 className="text-lg font-semibold text-slate-800">Aucune page accessible</h2>
      <p className="text-sm text-slate-500 mt-2">
        Votre groupe a accès à ce module, mais aucune page n’est autorisée pour le moment
        (groupe désactivé ou permissions insuffisantes). Un administrateur doit rétablir l’accès.
      </p>
    </div>
  );
}
