"use client";

export function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  lastRefresh,
  loading,
  onRefresh,
  onDownload,
  onPrint,
  downloadLabel = "Télécharger le rapport",
  printLabel = "Imprimer",
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 no-print">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        {lastRefresh && (
          <p className="text-xs text-slate-400 mt-0.5">
            Dernière mise à jour : {lastRefresh.toLocaleTimeString("fr-FR")}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {downloadLabel}
          </button>
        )}
        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {printLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
        <svg
          className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {loading ? "Chargement…" : "Actualiser"}
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="font-medium">Erreur de chargement</p>
        <p className="mt-0.5">{error}</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ kpiCount = 4, chartCount = 4 }) {
  const kpiGridClass =
    kpiCount >= 5
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
      : "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div className="animate-pulse space-y-6">
      <div className={kpiGridClass}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: chartCount }).map((_, i) => (
          <div key={i} className="h-72 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RefreshOverlay({ show, children }) {
  return (
    <div className="relative">
      {children}
      {show && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-2 rounded-lg shadow border border-slate-100">
            <svg className="w-4 h-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Mise à jour…
          </div>
        </div>
      )}
    </div>
  );
}

export function NoPermissionMessage({ message }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
      {message}
    </div>
  );
}
