"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser } from "../../services/auth.service";
import { clearAuthSession, hasClientSession } from "../../services/api";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(null);
  const [backendError, setBackendError] = useState(false);

  const isLoginPage = pathname === "/auth/login";
  const isPublicDownloadPage = pathname?.startsWith("/telechargement/");

  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      const hasSession = hasClientSession();

      if (!hasSession) {
        if (!cancelled) {
          setAuthorized(isLoginPage || isPublicDownloadPage);
        }
        return;
      }

      if (isLoginPage || isPublicDownloadPage) {
        if (!cancelled) {
          setAuthorized(true);
        }
        return;
      }

      try {
        await getCurrentUser();
        if (!cancelled) {
          setBackendError(false);
          setAuthorized(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.status === 401) {
          await clearAuthSession();
          setAuthorized(false);
          window.location.replace("/auth/login?session=expired");
          return;
        }
        setBackendError(true);
        setAuthorized(false);
      }
    };

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, isPublicDownloadPage, pathname]);

  useEffect(() => {
    const hasSession = hasClientSession();

    if (!hasSession && !isLoginPage && !isPublicDownloadPage) {
      setAuthorized(false);
      router.replace("/auth/login");
      return;
    }

    // Ne pas auto-rediriger la page login ici : le formulaire gère la navigation
    // après authentification (évite les courses avec le cookie).
  }, [pathname, router, isLoginPage, isPublicDownloadPage]);

  if (backendError && !isLoginPage && !isPublicDownloadPage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Serveur inaccessible</h1>
          <p className="text-sm text-gray-600">
            Impossible de vérifier votre session. Réessayez dans quelques instants.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-900 text-white text-sm"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (authorized === null && !isLoginPage && !isPublicDownloadPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Vérification de la session…</p>
      </div>
    );
  }

  if (authorized === false && !isLoginPage && !isPublicDownloadPage) {
    return null;
  }

  return children;
}
