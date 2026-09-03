"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAideModulePath } from "../../../constants/aideVideo";
import { downloadDocumentFile } from "../../../services/documentLocalite.service";
import { getGuideAide } from "../../../services/guideAide.service";

function AideYoutubePlayer({ embedUrl, title }) {
  const [enlarged, setEnlarged] = useState(false);

  const src = useMemo(() => {
    if (!embedUrl) return "";
    try {
      const url = new URL(embedUrl);
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("fs", "0");
      if (typeof window !== "undefined") {
        url.searchParams.set("widget_referrer", window.location.href);
      }
      return url.toString();
    } catch {
      return embedUrl;
    }
  }, [embedUrl]);

  useEffect(() => {
    if (!enlarged) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setEnlarged(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [enlarged]);

  if (!src) return null;

  return (
    <>
      {enlarged && <div className="w-full max-w-xl aspect-video rounded-xl bg-slate-200" aria-hidden />}
      <div
        className={
          enlarged
            ? "fixed inset-0 z-[80] bg-black/75 flex flex-col items-center justify-center p-4 sm:p-8"
            : "relative w-full max-w-xl"
        }
      >
        <div
          className={
            enlarged
              ? "relative z-10 w-full max-w-5xl aspect-video"
              : "relative w-full aspect-video"
          }
        >
          <iframe
            className="w-full h-full rounded-xl bg-black"
            src={src}
            title={title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
          <button
            type="button"
            onClick={() => setEnlarged((open) => !open)}
            className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm font-medium hover:bg-black/85"
          >
            {enlarged ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Réduire
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Agrandir
              </>
            )}
          </button>
        </div>
        {enlarged && (
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 z-0 cursor-default"
            onClick={() => setEnlarged(false)}
          />
        )}
      </div>
    </>
  );
}

export default function AideVideoTutorielPage({ params }) {
  const router = useRouter();
  const { tutorielId } = use(params);
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getGuideAide(tutorielId)
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Tutoriel introuvable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tutorielId]);

  if (loading) {
    return <p className="py-16 text-slate-500">Chargement…</p>;
  }

  if (error || !guide) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-600 font-medium">{error || "Tutoriel introuvable."}</p>
        <button type="button" onClick={() => router.push("/aide-video")} className="mt-4 text-rose-600 hover:underline">
          Retour à l’aide
        </button>
      </div>
    );
  }

  const steps = guide.etapes?.length ? guide.etapes : [];
  const documents = guide.documents || [];
  const modulePath = getAideModulePath(guide.module_code);

  return (
    <div className="w-full min-w-0">
      <nav className="text-sm flex flex-wrap items-center gap-1.5 mb-6">
        <button type="button" onClick={() => router.push("/")} className="text-slate-500 hover:text-rose-600">
          Accueil
        </button>
        <span className="text-slate-300">/</span>
        <button type="button" onClick={() => router.push("/aide-video")} className="text-slate-500 hover:text-rose-600">
          Aide Vidéo
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-rose-700 font-semibold">{guide.titre}</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-800 mb-1">{guide.titre}</h1>
      <p className="text-slate-500 mb-6">{guide.description}</p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {guide.youtube_embed_url && (
            <AideYoutubePlayer embedUrl={guide.youtube_embed_url} title={guide.titre} />
          )}

          {documents.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Documents du guide</h2>
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => downloadDocumentFile(doc.url, doc.nom || "document")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-700 text-left"
                    >
                      <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{doc.nom}</span>
                      <span className="ml-auto text-xs text-slate-400 shrink-0">Télécharger</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 min-w-0">
          <h2 className="font-semibold text-slate-800 mb-4">Assistance pas à pas</h2>
          {steps.length > 0 ? (
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={`${index}-${step.slice(0, 24)}`} className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-rose-100 text-rose-700 text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="text-slate-600 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-slate-500 text-sm">Aucun guide écrit pour l’instant.</p>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push(modulePath)}
          className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700"
        >
          Ouvrir le module
        </button>
        <button
          type="button"
          onClick={() => router.push("/aide-video")}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Tous les tutoriels
        </button>
      </div>
    </div>
  );
}
