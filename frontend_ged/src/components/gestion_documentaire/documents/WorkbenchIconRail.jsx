"use client";

/**
 * Rail d'icônes vertical (style Dockmee) + panneau latéral conditionnel.
 * Le document reste au centre ; chaque icône ouvre un panneau dédié.
 */
export default function WorkbenchIconRail({
  items = [],
  activeId = null,
  onSelect,
  panelTitle = "",
  panelContent = null,
  accent = "emerald",
}) {
  const railActive =
    accent === "amber"
      ? "bg-amber-500/20 text-amber-100 after:bg-amber-400"
      : "bg-emerald-500/20 text-emerald-100 after:bg-emerald-400";

  const showPanel = Boolean(activeId && panelContent);

  return (
    <div className="flex shrink-0 min-h-0 h-full border-l border-slate-200 bg-white">
      {showPanel && (
        <div className="w-80 xl:w-96 2xl:w-[28rem] flex flex-col min-h-0 border-r border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{panelTitle}</h4>
            <button
              type="button"
              onClick={() => onSelect?.(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Fermer le panneau"
              aria-label="Fermer le panneau"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">{panelContent}</div>
        </div>
      )}

      <nav
        className="w-12 shrink-0 bg-slate-900 flex flex-col items-center py-2 gap-1"
        aria-label="Panneaux du document"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={isActive}
              onClick={() => onSelect?.(isActive ? null : item.id)}
              className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition ${
                isActive
                  ? `${railActive} after:absolute after:left-0 after:top-2 after:bottom-2 after:w-0.5 after:rounded-full`
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.icon}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function RailIcon({ children }) {
  return <span className="w-5 h-5 flex items-center justify-center">{children}</span>;
}
