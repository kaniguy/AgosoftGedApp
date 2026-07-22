"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  downloadPublicLienFichier,
  getPublicLienInfo,
} from "../../../services/liensTelechargement.service";
import { formatDisplayDateTime } from "../../../utils/dateFormat";

const STATUS_ICONS = {
  active: (
    <svg className="w-12 h-12 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  disabled: (
    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  expired: (
    <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  partial: (
    <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  unavailable: (
    <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  not_found: (
    <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function TelechargementPublicPage({ params }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState("");

  const loadInfo = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await getPublicLienInfo(token);
      setInfo(data);
    } catch {
      setInfo({
        can_download: false,
        status: "not_found",
        message: "Impossible de vérifier ce lien. Réessayez plus tard.",
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleDownload = async () => {
    setDownloadError("");
    setDownloadSuccess("");
    setDownloading(true);
    try {
      const filename = await downloadPublicLienFichier(token);
      setDownloadSuccess(`Téléchargement lancé : ${filename}`);
    } catch (err) {
      setDownloadError(err.message || "Téléchargement impossible.");
    } finally {
      setDownloading(false);
    }
  };

  const status = info?.status || "not_found";
  const icon = STATUS_ICONS[status] || STATUS_ICONS.not_found;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-8 text-center border-b border-slate-100 bg-gradient-to-r from-cyan-600 to-sky-600 text-white">
          <p className="text-xs uppercase tracking-widest text-cyan-100 font-semibold">AGOSOFT GED</p>
          <h1 className="text-xl font-bold mt-1">Téléchargement sécurisé</h1>
        </div>

        <div className="px-6 py-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-400">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Vérification du lien…</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">{icon}</div>
              <p className="text-center text-slate-700 text-sm leading-relaxed mb-4">
                {info?.message}
              </p>

              {info?.can_download && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600 space-y-1 mb-5">
                  <p>
                    <span className="font-semibold text-slate-700">Contenu :</span>{" "}
                    {info.status === "partial" && info.document_count_total ? (
                      <>
                        {info.document_count} sur {info.document_count_total} document
                        {info.document_count_total > 1 ? "s" : ""} disponible
                        {info.document_count > 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        {info.document_count} document{info.document_count > 1 ? "s" : ""}
                      </>
                    )}
                    {info.is_archive ? " (archive .rar)" : ""}
                  </p>
                  {info.status === "partial" && (
                    <p className="text-orange-700">
                      Certains documents ne sont plus disponibles et seront exclus du téléchargement.
                    </p>
                  )}
                  {info.expires_at && (
                    <p>
                      <span className="font-semibold text-slate-700">Expire le :</span>{" "}
                      {formatDisplayDateTime(info.expires_at)}
                    </p>
                  )}
                </div>
              )}

              {info?.can_download ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white font-semibold shadow-md shadow-cyan-200 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  {downloading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Préparation…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Télécharger
                    </>
                  )}
                </button>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">
                  Le téléchargement n&apos;est pas disponible pour ce lien.
                </div>
              )}

              {downloadError && (
                <p className="mt-3 text-center text-sm text-red-600">{downloadError}</p>
              )}
              {downloadSuccess && (
                <p className="mt-3 text-center text-sm text-emerald-600">{downloadSuccess}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
