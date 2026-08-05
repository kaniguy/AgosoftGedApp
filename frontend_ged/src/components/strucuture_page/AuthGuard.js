"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser } from "../../services/auth.service";
import { clearAuthSession } from "../../services/api";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  // null = vérification en cours, true = autorisé, false = refusé
  const [authorized, setAuthorized] = useState(null);
  const [backendError, setBackendError] = useState(false);

  const isLoginPage = pathname === "/auth/login";
  const isPublicDownloadPage = pathname?.startsWith("/telechargement/");

  // Validation de session une seule fois au chargement (pas à chaque navigation).
  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (!cancelled) {
          setAuthorized(isLoginPage || isPublicDownloadPage);
        }
        return;
      }

      if (isLoginPage) {
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
          clearAuthSession();
          setAuthorized(false);
          router.replace("/auth/login?session=expired");
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
  }, [isLoginPage, isPublicDownloadPage, router]);

  // Garde de route sans appel API : redirections locales uniquement.
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token && !isLoginPage && !isPublicDownloadPage) {
      setAuthorized(false);
      router.push("/auth/login");
      return;
    }

    if (token && isLoginPage) {
      router.push("/");
    }
  }, [pathname, router, isLoginPage, isPublicDownloadPage]);

  // Affichage erreur serveur injoignable
  if (backendError && !isLoginPage && !isPublicDownloadPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center space-y-5 max-w-sm text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-800 font-semibold text-base">Serveur inaccessible</p>
            <p className="text-slate-500 text-sm mt-1">
              Impossible de contacter le serveur. Vérifiez votre connexion ou contactez l&apos;administrateur.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Vérification en cours (authorized === null)
  if (authorized === null && !isLoginPage && !isPublicDownloadPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600 text-sm font-semibold tracking-wide animate-pulse">
            Vérification de session...
          </p>
        </div>
      </div>
    );
  }

  if (!authorized && !isLoginPage && !isPublicDownloadPage) {
    return null;
  }

  return children;
}
