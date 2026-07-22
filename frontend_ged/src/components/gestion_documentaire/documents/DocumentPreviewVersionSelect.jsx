"use client";

export default function DocumentPreviewVersionSelect({
  value,
  options,
  loading,
  disabled,
  onChange,
}) {
  if (!options?.length) return null;

  return (
    <label className="inline-flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
        Version
      </span>
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange?.(e.target.value)}
        className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 max-w-[9.5rem] truncate disabled:opacity-50"
        title="Version à afficher"
      >
        {loading && options.length <= 1 ? (
          <option value={value}>Chargement…</option>
        ) : (
          options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
