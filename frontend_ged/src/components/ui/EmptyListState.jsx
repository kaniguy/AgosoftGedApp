"use client";

import { useId } from "react";

const TONES = {
  emerald: { accent: "#10b981", glass: "rgba(16, 185, 129, 0.22)" },
  purple: { accent: "#8b5cf6", glass: "rgba(139, 92, 246, 0.22)" },
  orange: { accent: "#f97316", glass: "rgba(249, 115, 22, 0.22)" },
  cyan: { accent: "#06b6d4", glass: "rgba(6, 182, 212, 0.22)" },
  amber: { accent: "#f59e0b", glass: "rgba(245, 158, 11, 0.22)" },
  slate: { accent: "#64748b", glass: "rgba(100, 116, 139, 0.22)" },
};

function SearchingCritter({ compact = false, tone = "emerald" }) {
  const colors = TONES[tone] || TONES.slate;
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      className="empty-critter"
      viewBox="0 0 280 220"
      width={compact ? 176 : 248}
      height={compact ? 138 : 194}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`shell-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id={`paper-${uid}`} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f7" />
        </linearGradient>
        <radialGradient id={`lens-${uid}`} cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.62)" />
          <stop offset="62%" stopColor={colors.glass} />
          <stop offset="100%" stopColor="rgba(15,23,42,0.1)" />
        </radialGradient>
        <linearGradient id={`visor-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <clipPath id={`visor-clip-${uid}`}>
          <rect x="104" y="54" width="72" height="36" rx="12" />
        </clipPath>
        <filter id={`soft-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.13" />
        </filter>
      </defs>

      <ellipse className="empty-critter-shadow" cx="140" cy="208" rx="46" ry="8" fill={colors.accent} />

      <g className="empty-critter-move" filter={`url(#soft-${uid})`}>
        <g className="empty-critter-antenna">
          <path d="M140 38 V16" stroke="#64748b" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="140" cy="12" r="6.5" fill={colors.accent} />
          <circle className="empty-critter-sparkle" cx="140" cy="12" r="9" fill={colors.accent} opacity="0.28" />
        </g>

        <g className="empty-critter-head">
          <rect x="92" y="36" width="96" height="68" rx="22" fill={`url(#shell-${uid})`} stroke="#94a3b8" strokeWidth="1.8" />
          <rect x="104" y="54" width="72" height="36" rx="12" fill={`url(#visor-${uid})`} />
          <g clipPath={`url(#visor-clip-${uid})`}>
            <rect className="empty-critter-scan" x="104" y="54" width="72" height="8" fill={colors.accent} opacity="0.35" />
          </g>
          <g className="empty-critter-eyes">
            <g className="empty-critter-blink" style={{ transformOrigin: "122px 72px" }}>
              <circle cx="122" cy="72" r="7.5" fill={colors.accent} />
              <circle cx="124" cy="70" r="2.2" fill="white" />
            </g>
            <g className="empty-critter-blink" style={{ transformOrigin: "158px 72px" }}>
              <circle cx="158" cy="72" r="7.5" fill={colors.accent} />
              <circle cx="160" cy="70" r="2.2" fill="white" />
            </g>
          </g>
        </g>

        <rect x="128" y="102" width="24" height="12" rx="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.2" />

        <g className="empty-critter-body">
          <path
            d="M104 118 H164 L180 134 V190 H104 Z"
            fill={`url(#paper-${uid})`}
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M164 118 L180 134 H164 Z" fill="#dbe4ee" stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="118" y="108" width="36" height="12" rx="3" fill={colors.accent} opacity="0.9" />
          <path d="M118 142 H158" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <path d="M118 154 H166" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          <path d="M118 166 H150" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          <path d="M118 178 H160" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
        </g>

        <rect x="112" y="190" width="18" height="10" rx="4" fill="#94a3b8" />
        <rect x="150" y="190" width="18" height="10" rx="4" fill="#94a3b8" />

        <ellipse cx="112" cy="148" rx="9" ry="14" fill={`url(#shell-${uid})`} stroke="#94a3b8" strokeWidth="1.4" />

        <g className="empty-critter-arm">
          <ellipse cx="170" cy="148" rx="10" ry="15" fill={`url(#shell-${uid})`} stroke="#94a3b8" strokeWidth="1.4" transform="rotate(22 170 148)" />
          <g className="empty-critter-loupe">
            <circle cx="206" cy="106" r="34" fill={`url(#lens-${uid})`} stroke="#1e293b" strokeWidth="7" />
            <circle cx="206" cy="106" r="34" stroke={colors.accent} strokeWidth="2.2" opacity="0.95" />
            <path d="M230 132 L252 160" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
            <path d="M230 132 L252 160" stroke={colors.accent} strokeWidth="2.6" strokeLinecap="round" opacity="0.75" />
            <path className="empty-critter-glint" d="M188 86 L200 78" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export default function EmptyListState({
  title = "Aucun élément",
  description,
  tone = "emerald",
  action = null,
  compact = false,
}) {
  const colors = TONES[tone] || TONES.slate;

  return (
    <div
      className={`empty-list-state flex flex-col items-center justify-center text-center px-6 ${
        compact ? "py-8" : "py-12 sm:py-16"
      }`}
      style={{ ["--empty-accent"]: colors.accent, ["--empty-glass"]: colors.glass }}
    >
      <div className="empty-search-stage">
        <SearchingCritter compact={compact} tone={tone} />
        <div className="empty-search-caption">
          <p className={`empty-search-title ${compact ? "text-sm" : "text-lg"}`}>{title}</p>
          <span className="empty-search-glass" aria-hidden>
            <span className="empty-search-glass-text">{title}</span>
          </span>
        </div>
      </div>
      {description && (
        <p className={`empty-search-desc text-slate-500 mt-3 max-w-md ${compact ? "text-xs" : "text-sm"}`}>
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-4" : "mt-6"}>{action}</div>}
    </div>
  );
}
