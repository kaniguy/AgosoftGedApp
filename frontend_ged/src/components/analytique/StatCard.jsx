"use client";

export default function StatCard({ title, value, subtitle, icon, color = "orange", trend }) {
  const colorMap = {
    orange: {
      bg: "bg-orange-50",
      iconBg: "bg-orange-100",
      iconText: "text-orange-600",
      value: "text-orange-700",
      border: "border-orange-100",
    },
    green: {
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      value: "text-emerald-700",
      border: "border-emerald-100",
    },
    blue: {
      bg: "bg-sky-50",
      iconBg: "bg-sky-100",
      iconText: "text-sky-600",
      value: "text-sky-700",
      border: "border-sky-100",
    },
    red: {
      bg: "bg-rose-50",
      iconBg: "bg-rose-100",
      iconText: "text-rose-600",
      value: "text-rose-700",
      border: "border-rose-100",
    },
    purple: {
      bg: "bg-purple-50",
      iconBg: "bg-purple-100",
      iconText: "text-purple-600",
      value: "text-purple-700",
      border: "border-purple-100",
    },
    amber: {
      bg: "bg-amber-50",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
      value: "text-amber-700",
      border: "border-amber-100",
    },
  };

  const c = colorMap[color] || colorMap.orange;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
        <span className={c.iconText}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
        <p className={`text-3xl font-bold mt-0.5 ${c.value}`}>{value ?? "—"}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-1 ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {trend >= 0 ? "+" : ""}{trend}% vs mois précédent
          </p>
        )}
      </div>
    </div>
  );
}
