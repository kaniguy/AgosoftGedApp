// Page de contrôle qualité — validation d'un document enregistré
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getPlanGeographique } from "../../../../../services/planGeographique.service";
import { getDocumentLocalite } from "../../../../../services/documentLocalite.service";
import DocumentControleQualitePanel from "../../../../../components/controle_qualite/DocumentControleQualitePanel";
import {
  getControleQualiteStatutConfig,
  isControleQualiteStatut,
} from "../../../../../constants/controleQualiteMenu";
import {
  canOpenDocumentQc,
  canViewStatutMenu,
  getDefaultStatutMenu,
} from "../../../../../utils/controleQualitePermissions";
import { ControleQualiteStatutGate } from "../../../../../components/controle_qualite/ControleQualiteAccessGate";
import { STATUT_BROUILLON } from "../../../../../utils/documentStatutQualite";

function ControleQualiteValidationContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const localiteId = params?.localiteId;
  const documentId = params?.documentId;

  const statutParam = searchParams.get("statut");
  const statut = isControleQualiteStatut(statutParam) ? statutParam : getDefaultStatutMenu();

  const [localite, setLocalite] = useState(null);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  useEffect(() => {
    if (!localiteId || !documentId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [localiteData, doc] = await Promise.all([
          getPlanGeographique(localiteId),
          getDocumentLocalite(documentId),
        ]);

        if (Number(doc.localite) !== Number(localiteId)) {
          setError("Ce document n'appartient pas à cette localité.");
          return;
        }

        setLocalite(localiteData);
        setDocument(doc);
        const docStatut = doc.statut_qualite || statut;
        if (docStatut === STATUT_BROUILLON) {
          setError(
            "Ce document est encore en brouillon : il n'a pas été soumis au contrôle qualité. Utilisez « Soumettre au contrôle qualité » lors du rattachement, ou « Envoyer au QC » depuis la liste des brouillons."
          );
        } else if (!canViewStatutMenu(docStatut) || !canOpenDocumentQc(docStatut)) {
          setError("Vous n'avez pas les droits pour ouvrir ce document en contrôle qualité.");
        }
      } catch (err) {
        setError(err.message || "Impossible de charger le contrôle qualité");
      } finally {
        setLoading(false);
      }
    })();
  }, [localiteId, documentId, statut]);

  const docStatutQualite = document?.statut_qualite;
  const activeStatut =
    docStatutQualite && isControleQualiteStatut(docStatutQualite)
      ? docStatutQualite
      : statut;
  const activeStatutConfig = getControleQualiteStatutConfig(activeStatut);

  const statutListUrl = `${activeStatutConfig.path}?casier=${localiteId}`;

  const handleClose = () => {
    router.push(statutListUrl);
  };

  const handleValidated = (result, options = {}) => {
    const messages = {
      valide: options.goNext
        ? "Document validé — passage au document suivant"
        : options.goNextCasier
          ? `Document validé — lot ${options.nextCasierCode || options.nextCasierLabel} (${options.nextCasierDocCount} doc.)`
          : options.allComplete
            ? "Document validé — plus de documents en attente"
            : "Document validé et archivé avec succès",
      soumis: options.goNext
        ? "Document soumis — passage au document suivant"
        : options.goNextCasier
          ? `Document soumis — lot ${options.nextCasierCode || options.nextCasierLabel} (${options.nextCasierDocCount} doc.)`
          : options.allComplete
            ? "Document soumis — plus de documents rejetés dans ce casier"
            : "Document soumis au contrôle qualité",
      rejete: options.goNext
        ? "Document rejeté — passage au document suivant"
        : options.goNextCasier
          ? `Document rejeté — lot ${options.nextCasierCode || options.nextCasierLabel} (${options.nextCasierDocCount} doc.)`
          : options.allComplete
            ? "Document rejeté — file terminée"
            : "Document rejeté",
      enregistre: "Brouillon enregistré",
    };
    showNotification(messages[result] || "Opération réussie", result === "rejete" ? "warning" : "success");

    const continueStatut = activeStatut;

    if (
      (result === "valide" || result === "rejete" || result === "soumis") &&
      options.goNext &&
      options.nextDocumentId
    ) {
      router.push(
        `/controle_qualite/validation/${localiteId}/${options.nextDocumentId}?statut=${continueStatut}`
      );
      return;
    }

    if (
      (result === "valide" || result === "rejete" || result === "soumis") &&
      options.goNextCasier &&
      options.nextCasierId &&
      options.nextDocumentId
    ) {
      router.push(
        `/controle_qualite/validation/${options.nextCasierId}/${options.nextDocumentId}?statut=${continueStatut}`
      );
      return;
    }

    if (result === "soumis") {
      if (options.casierComplete) {
        router.push(statutListUrl);
        return;
      }
      if (options.allComplete) {
        router.push(statutListUrl);
        return;
      }
      router.push(activeStatutConfig.path);
      return;
    }

    if (options.casierComplete) {
      router.push(statutListUrl);
      return;
    }

    if (result === "valide" && options.allComplete) {
      router.push(activeStatutConfig.path);
      return;
    }

    if (result === "rejete" && options.allComplete) {
      router.push(`${getControleQualiteStatutConfig("rejete").path}?casier=${localiteId}`);
      return;
    }

    const nextStatut =
      result === "valide"
        ? "valide"
        : result === "rejete"
          ? "rejete"
          : activeStatut;

    const nextConfig = getControleQualiteStatutConfig(nextStatut);
    const keepCasier = result === "rejete" || result === "enregistre";
    router.push(`${nextConfig.path}${keepCasier ? `?casier=${localiteId}` : ""}`);
  };

  return (
    <div className="flex flex-col h-[calc(100*var(--app-vh)-7.5rem)] min-h-[40rem] -mx-6">
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
                    : "bg-emerald-500"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      <div className="mb-4 short:mb-1.5 shrink-0">
        <nav className="text-sm short:text-xs text-gray-500 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => router.push("/")} className="hover:text-yellow-600">
            Accueil
          </button>
          <span>/</span>
          <button type="button" onClick={() => router.push(activeStatutConfig.path)} className="hover:text-yellow-600">
            Contrôle qualité
          </button>
          <span>/</span>
          <button type="button" onClick={() => router.push(statutListUrl)} className="hover:text-yellow-600">
            {activeStatutConfig.shortLabel}
          </button>
          <span>/</span>
          <button type="button" onClick={handleClose} className="hover:text-yellow-600">
            {localite?.libelle || "Casier"}
          </button>
          <span>/</span>
          <span className="text-gray-700 font-medium">Contrôle</span>
        </nav>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
            <p className="mt-4 text-gray-500">Chargement du contrôle qualité…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
          >
            Retour à la liste
          </button>
          {document?.statut_qualite === STATUT_BROUILLON && (
            <button
              type="button"
              onClick={() => router.push("/gestion_documentaire/brouillons")}
              className="mt-4 ml-2 px-4 py-2 border border-yellow-400 text-yellow-800 bg-white rounded-lg text-sm hover:bg-yellow-50"
            >
              Liste des brouillons
            </button>
          )}
        </div>
      )}

      {!loading && localite && document && !error && (
        <ControleQualiteStatutGate statut={activeStatut}>
        <div className="flex-1 min-h-0 flex flex-col">
          <DocumentControleQualitePanel
            localite={localite}
            document={document}
            queueStatut={activeStatut}
            onNavigateDocument={(docId) =>
              router.push(
                `/controle_qualite/validation/${localiteId}/${docId}?statut=${activeStatut}`
              )
            }
            onClose={handleClose}
            onValidated={handleValidated}
            onNotify={showNotification}
          />
        </div>
        </ControleQualiteStatutGate>
      )}
    </div>
  );
}

export default function ControleQualiteValidationPage() {
  return (
    <Suspense fallback={<p className="text-gray-500 py-16 text-center">Chargement…</p>}>
      <ControleQualiteValidationContent />
    </Suspense>
  );
}
