"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmsAction,
  downloadSauvegardeJob,
  getSauvegardeStatus,
  startExportSauvegarde,
  startResetSauvegarde,
  startRestoreSauvegarde,
  waitSauvegardeJob,
} from "../../../services/sauvegarde.service";
import { clearAuthSession } from "../../../services/api";
import {
  PERMISSIONS,
  canAccessSauvegardeBase,
  hasPermission,
} from "../../../utils/permissions";

function formatBytes(value) {
  const n = Number(value) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function OperationProgress({ progress, accent = "purple" }) {
  if (!progress) return null;
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  const bar =
    accent === "rose"
      ? "bg-rose-600"
      : accent === "amber"
        ? "bg-amber-600"
        : "bg-purple-600";
  return (
    <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
        <span>{progress.message || "Traitement…"}</span>
        <span className="tabular-nums font-medium">{percent} %</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full ${bar} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {Array.isArray(progress.steps) && progress.steps.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {progress.steps.map((step) => {
            const current = step.id === progress.stage && progress.status !== "done";
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2 text-xs ${
                  step.done
                    ? "text-emerald-700"
                    : current
                      ? "font-medium text-gray-800"
                      : "text-gray-400"
                }`}
              >
                <span className="w-4 text-center">
                  {step.done ? "✓" : current ? "●" : "○"}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function BaseDeDonneesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(null);

  const canOpen = mounted && canAccessSauvegardeBase();
  const confirmRestore = status?.confirmation?.restaurer || "RESTAURER";
  const confirmReset = status?.confirmation?.reinitialiser || "REINITIALISER";
  const restoreReady = Boolean(restoreFile) && confirmsAction(restoreConfirm, confirmRestore);
  const resetReady = confirmsAction(resetConfirm, confirmReset);
  const busy = exporting || restoring || resetting;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canAccessSauvegardeBase()) return;
    let cancelled = false;
    getSauvegardeStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setMessage({ type: "error", text: err.message || "Chargement impossible." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const handleExport = async () => {
    setExporting(true);
    setMessage({ type: "", text: "" });
    setExportProgress({
      status: "running",
      stage: "dump",
      percent: 2,
      message: "Démarrage de l'export…",
      steps: [
        { id: "dump", label: "Export des données SQL", done: false },
        { id: "archive", label: "Compression des fichiers media", done: false },
        { id: "ready", label: "Téléchargement de l'archive", done: false },
      ],
    });
    try {
      const job = await startExportSauvegarde();
      const done = await waitSauvegardeJob(job.job_id, job.token, setExportProgress);
      await downloadSauvegardeJob(job.job_id, job.token, setExportProgress);
      setExportProgress({
        ...done,
        status: "done",
        percent: 100,
        message: "Sauvegarde téléchargée.",
        stage: "ready",
        steps: (done.steps || []).map((step) => ({ ...step, done: true })),
      });
      setMessage({ type: "success", text: "Sauvegarde téléchargée (base + fichiers)." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      setExportProgress(null);
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      setMessage({ type: "error", text: "Choisissez un fichier .zip de sauvegarde." });
      return;
    }
    if (!restoreReady) {
      setMessage({ type: "error", text: `Saisissez ${confirmRestore} pour confirmer.` });
      return;
    }
    const ok = window.confirm(
      "Attention : la restauration remplace la base actuelle.\n\nVous serez déconnecté ensuite. Reconnectez-vous avec le même compte.\n\nContinuer ?",
    );
    if (!ok) return;
    setRestoring(true);
    setMessage({ type: "", text: "" });
    setRestoreProgress({
      status: "running",
      stage: "upload",
      percent: 1,
      message: "Envoi de l'archive…",
    });
    try {
      const job = await startRestoreSauvegarde(restoreFile, restoreConfirm, setRestoreProgress);
      await waitSauvegardeJob(job.job_id, job.token, setRestoreProgress);
      setMessage({ type: "success", text: "Restauration terminée. Vous allez être déconnecté…" });
      await clearAuthSession();
      router.replace("/auth/login");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      setRestoreProgress(null);
      setRestoring(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetReady) {
      setMessage({ type: "error", text: `Saisissez ${confirmReset} pour confirmer.` });
      return;
    }
    const ok = window.confirm(
      "Attention : la réinitialisation vide documents, paramétrage et fichiers.\n\nVous serez déconnecté ensuite. Reconnectez-vous avec un compte administrateur.\n\nContinuer ?",
    );
    if (!ok) return;
    setResetting(true);
    setMessage({ type: "", text: "" });
    setResetProgress({
      status: "running",
      stage: "flush",
      percent: 2,
      message: "Démarrage de la réinitialisation…",
    });
    try {
      const job = await startResetSauvegarde(resetConfirm);
      await waitSauvegardeJob(job.job_id, job.token, setResetProgress);
      setMessage({ type: "success", text: "Base réinitialisée. Vous allez être déconnecté…" });
      await clearAuthSession();
      router.replace("/auth/login");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      setResetProgress(null);
      setResetting(false);
    }
  };

  if (!mounted) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  if (!canOpen) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
        Vous n&apos;avez pas la permission d&apos;accéder à la base de données.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Base de données</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sauvegarde, restauration et réinitialisation (données + fichiers media).
          Pour relire les documents après restauration, garder la même clé
          DOCUMENT_ENCRYPTION_KEY dans le .env.
        </p>
      </div>

      {status && (
        <div className="mb-6 rounded-lg border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          <span className="font-medium">{status.db_name || "Base"}</span>
          {status.media?.fichier_count != null && (
            <>
              {" · "}
              {status.media.fichier_count} fichier(s) media
              {" · "}
              {formatBytes(status.media.taille_octets)}
            </>
          )}
        </div>
      )}

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800">Exporter</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Télécharge une archive .zip : données SQL et dossier media (documents, logos…).
          </p>
          {hasPermission(PERMISSIONS.EXPORTER_SAUVEGARDE_BASE) ? (
            <>
              <button
                type="button"
                onClick={handleExport}
                disabled={busy}
                className="mt-5 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {exporting ? "Export en cours…" : "Télécharger la sauvegarde"}
              </button>
              <OperationProgress progress={exporting ? exportProgress : null} />
            </>
          ) : (
            <p className="mt-5 text-sm text-gray-500">Pas le droit d&apos;exporter.</p>
          )}
        </div>

        <form
          onSubmit={handleRestore}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-base font-semibold text-gray-800">Restaurer</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Remplace la base actuelle par une sauvegarde GED.
          </p>
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Après la restauration, vous serez déconnecté. Il faudra vous reconnecter.
          </p>
          {hasPermission(PERMISSIONS.RESTAURER_SAUVEGARDE_BASE) ? (
            <>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => {
                  setRestoreFile(e.target.files?.[0] || null);
                  setMessage({ type: "", text: "" });
                }}
                disabled={busy}
                className="mt-4 block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700"
              />
              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                Tapez {confirmRestore} pour confirmer
              </label>
              <input
                type="text"
                value={restoreConfirm}
                onChange={(e) => {
                  setRestoreConfirm(e.target.value);
                  setMessage({ type: "", text: "" });
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !restoreReady}
                className="mt-4 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {restoring ? "Restauration…" : "Restaurer"}
              </button>
              {!restoreReady && !restoring && (
                <p className="mt-2 text-xs text-gray-500">
                  Choisissez le zip puis saisissez exactement {confirmRestore}.
                </p>
              )}
              <OperationProgress progress={restoring ? restoreProgress : null} accent="amber" />
            </>
          ) : (
            <p className="mt-5 text-sm text-gray-500">Pas le droit de restaurer.</p>
          )}
        </form>

        <form
          onSubmit={handleReset}
          className="bg-white rounded-lg shadow-sm border border-rose-100 p-6"
        >
          <h2 className="text-base font-semibold text-rose-800">Réinitialiser</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Vide documents, paramétrage et fichiers. Les comptes administrateur sont conservés.
          </p>
          <p className="mt-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            Après la réinitialisation, vous serez déconnecté. Il faudra vous reconnecter.
          </p>
          {hasPermission(PERMISSIONS.REINITIALISER_SAUVEGARDE_BASE) ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                Tapez {confirmReset} pour confirmer
              </label>
              <input
                type="text"
                value={resetConfirm}
                onChange={(e) => {
                  setResetConfirm(e.target.value);
                  setMessage({ type: "", text: "" });
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !resetReady}
                className="mt-4 px-5 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {resetting ? "Réinitialisation…" : "Réinitialiser la base"}
              </button>
              {!resetReady && !resetting && (
                <p className="mt-2 text-xs text-gray-500">
                  Saisissez exactement {confirmReset} pour activer le bouton.
                </p>
              )}
              <OperationProgress progress={resetting ? resetProgress : null} accent="rose" />
            </>
          ) : (
            <p className="mt-5 text-sm text-gray-500">Pas le droit de réinitialiser.</p>
          )}
        </form>
      </div>
    </div>
  );
}
