// Page dédiée au rattachement d'un document sur une localité (espace plein écran)
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { getPlanGeographique } from "../../../../../services/planGeographique.service";
import DocumentRattachementPanel from "../../../../../components/gestion_documentaire/documents/DocumentRattachementPanel";
import {
  RattachementLeaveGuardProvider,
  useRattachementLeaveGuard,
} from "../../../../../components/gestion_documentaire/documents/RattachementLeaveGuard";
import { getStoredUser, MODELS, useCrudPermissions } from "../../../../../utils/permissions";
import {
  canRedirectToControleQualiteAfterImport,
  getControleQualiteRedirectAfterImport,
} from "../../../../../utils/controleQualitePermissions";
import { findRattachementDraftForLocalite } from "../../../../../utils/rattachementDraftStore";
import { PLAN_GEO_RESTORE_PATH } from "../../../../../components/gestion_documentaire/plan_geographique/planGeoNavigationState";

function RattacherDocumentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const localiteId = params?.localiteId;
  const draftFromUrl = searchParams.get("draft");
  const { canAdd } = useCrudPermissions(MODELS.DOCUMENT_LOCALITE);
  const { requestNavigation } = useRattachementLeaveGuard();

  const [localite, setLocalite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [detectedDraft, setDetectedDraft] = useState(null);

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
        setError("Seul le dernier niveau géographique peut recevoir des documents.");
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
    if (!getStoredUser()) return;
    if (!canAdd) {
      router.replace("/gestion_documentaire/plan_geographique");
    }
  }, [canAdd, router]);

  useEffect(() => {
    loadLocalite();
  }, [loadLocalite]);

  useEffect(() => {
    if (draftFromUrl || !localiteId) {
      setDetectedDraft(null);
      return;
    }
    findRattachementDraftForLocalite(localiteId).then(setDetectedDraft);
  }, [localiteId, draftFromUrl]);

  const handleClose = () => {
    router.push(PLAN_GEO_RESTORE_PATH);
  };

  const guardedNavigate = useCallback(
    (hrefOrFn) => {
      if (typeof hrefOrFn === "function") {
        requestNavigation(hrefOrFn);
        return;
      }
      requestNavigation(() => router.push(hrefOrFn));
    },
    [requestNavigation, router]
  );

  const handleSaved = (result) => {
    const qcPath = getControleQualiteRedirectAfterImport(localiteId, result);
    if (qcPath) {
      router.push(qcPath);
      return;
    }
    const params = new URLSearchParams({
      docSaved: "1",
      localiteId: String(localiteId),
    });
    if (!canRedirectToControleQualiteAfterImport(localiteId)) {
      params.set("qcAccessDenied", "1");
    }
    router.push(`/gestion_documentaire/plan_geographique?${params}`);
  };

  const handleResumeDetectedDraft = () => {
    if (!detectedDraft?.id) return;
    router.replace(
      `/gestion_documentaire/plan_geographique/${localiteId}/rattacher?draft=${detectedDraft.id}`
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] -mx-6 min-h-0">
      {notification && (
        <div className="fixed top-20 right-5 z-[99999]">
          <div
            className={`min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg text-white ${
              notification.type === "error"
                ? "bg-red-500"
                : notification.type === "warning"
                  ? "bg-amber-500"
                  : notification.type === "info"
                    ? "bg-sky-600"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      <div className="mb-4 shrink-0">
        <nav className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => guardedNavigate("/")}
            className="hover:text-emerald-600"
          >
            Accueil
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => guardedNavigate(PLAN_GEO_RESTORE_PATH)}
            className="hover:text-emerald-600"
          >
            Plan de classement
          </button>
          <span>/</span>
          <span className="text-gray-700 font-medium">Rattacher un document</span>
        </nav>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            <p className="mt-4 text-gray-500">Chargement de la localité…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
          >
            Retour au plan de classement
          </button>
        </div>
      )}

      {!loading && localite && (
        <div className="flex-1 min-h-0 flex flex-col">
          {detectedDraft && !draftFromUrl && (
            <div className="mb-3 mx-6 shrink-0 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">Brouillon en cours sur cette localité</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {detectedDraft.pendingCount} document
                  {detectedDraft.pendingCount > 1 ? "s" : ""} non soumis
                  {detectedDraft.typeLibelle ? ` — ${detectedDraft.typeLibelle}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResumeDetectedDraft}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                >
                  Reprendre le lot
                </button>
                <Link
                  href="/gestion_documentaire/brouillons"
                  className="px-3 py-1.5 text-sm border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100"
                >
                  Tous les brouillons
                </Link>
              </div>
            </div>
          )}

          <DocumentRattachementPanel
            localite={localite}
            fullPage
            enableAppendDocuments
            initialDraftId={draftFromUrl || null}
            onClose={handleClose}
            onSaved={handleSaved}
            onNotify={showNotification}
          />
        </div>
      )}
    </div>
  );
}

function RattacherDocumentWithGuard() {
  const pathname = usePathname();
  return (
    <RattachementLeaveGuardProvider currentPath={pathname}>
      <RattacherDocumentContent />
    </RattachementLeaveGuardProvider>
  );
}

export default function RattacherDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      }
    >
      <RattacherDocumentWithGuard />
    </Suspense>
  );
}
