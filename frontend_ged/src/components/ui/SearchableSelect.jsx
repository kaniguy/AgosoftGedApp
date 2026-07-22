/**
 * Select searchable style Select2 — recherche, navigation clavier, liste filtrée.
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Choisir…",
  searchPlaceholder = "Rechercher…",
  disabled = false,
  clearable = true,
  accent = "cyan",
  className = "",
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label?.toLowerCase().includes(q) ||
        String(o.value ?? "").toLowerCase().includes(q) ||
        o.group?.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setHighlight(0);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [search]);

  const ringClass =
    accent === "cyan"
      ? "focus:border-cyan-400 focus:ring-cyan-100 border-cyan-300"
      : "focus:border-slate-400 focus:ring-slate-100";

  const itemActiveClass =
    accent === "cyan" ? "bg-cyan-50 text-cyan-900" : "bg-slate-100 text-slate-900";

  const selectOption = (opt) => {
    onChange?.(opt.value);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && filtered[highlight]) {
      e.preventDefault();
      selectOption(filtered[highlight]);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`
          w-full flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-sm text-left
          transition outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? ringClass : "border-slate-200 hover:border-slate-300"}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`flex-1 truncate ${selected ? "text-slate-800" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange?.("");
            }}
            className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
            aria-label="Effacer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
        <svg
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden"
          role="listbox"
          id={listId}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
              />
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">Aucun résultat</li>
            ) : (
              filtered.map((opt, idx) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === opt.value}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => selectOption(opt)}
                    className={`
                      w-full text-left px-3 py-2 text-sm transition
                      ${idx === highlight ? itemActiveClass : "text-slate-700 hover:bg-slate-50"}
                      ${value === opt.value ? "font-medium" : ""}
                    `}
                  >
                    {opt.group && (
                      <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
                        {opt.group}
                      </span>
                    )}
                    <span className="block truncate">{opt.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
