"use client";

const STATUT_STYLES = {
  total: {
    bg: "bg-orange-50 border-orange-200",
    value: "text-orange-800",
    badge: "bg-orange-200 text-orange-900",
  },
  en_attente: {
    bg: "bg-amber-50 border-amber-200",
    value: "text-amber-800",
    badge: "bg-amber-200 text-amber-900",
  },
  valide: {
    bg: "bg-emerald-50 border-emerald-200",
    value: "text-emerald-800",
    badge: "bg-emerald-200 text-emerald-900",
  },
  rejete: {
    bg: "bg-rose-50 border-rose-200",
    value: "text-rose-800",
    badge: "bg-rose-200 text-rose-900",
  },
};

const DEFAULT_STATUTS = [
  { statut: "en_attente", label: "En attente", count: 0, taux: 0 },
  { statut: "valide", label: "Validé", count: 0, taux: 0 },
  { statut: "rejete", label: "Rejeté", count: 0, taux: 0 },
];

export default function StatutKpiGrid({ total = 0, parStatut = [], activeStatut = "", onStatutClick }) {
  const statuts = DEFAULT_STATUTS.map((def) => {
    const found = parStatut.find((s) => s.statut === def.statut);
    return found ?? def;
  });

  const cards = [
    {
      key: "total",
      label: "Total",
      count: total,
      taux: total > 0 ? 100 : 0,
      statut: "",
      subtitle: "documents",
    },
    ...statuts.map((s) => ({
      key: s.statut,
      label: s.label,
      count: s.count,
      taux: s.taux,
      statut: s.statut,
      subtitle: `${s.taux} % du total`,
    })),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => {
        const style = STATUT_STYLES[card.key] || STATUT_STYLES.total;
        const isActive = card.statut && activeStatut === card.statut;
        const Tag = card.statut ? "button" : "div";

        return (
          <Tag
            key={card.key}
            type={card.statut ? "button" : undefined}
            onClick={card.statut ? () => onStatutClick?.(card.statut) : undefined}
            className={`
              rounded-xl border p-4 text-left transition-all
              ${style.bg}
              ${card.statut ? "cursor-pointer hover:shadow-md" : ""}
              ${isActive ? "ring-2 ring-orange-500 ring-offset-1" : ""}
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
              {card.key !== "total" && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {card.taux}%
                </span>
              )}
            </div>
            <p className={`text-3xl font-bold mt-2 ${style.value}`}>{card.count}</p>
            <p className="text-xs opacity-60 mt-1">{card.subtitle}</p>
          </Tag>
        );
      })}
    </div>
  );
}
