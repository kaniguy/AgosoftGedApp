"use client";

export default function RankingList({
  data = [],
  valueLabel = "actions",
  colorClass = "from-purple-500 to-purple-300",
  emptyMessage = "Aucune donnée disponible",
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.utilisateur || item.groupe || index} className="flex items-center gap-3">
          <span className="w-5 text-xs font-bold text-slate-400 text-right shrink-0">{index + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700 truncate">
                {item.utilisateur || item.groupe}
              </span>
              <span className="text-xs font-bold text-slate-700 ml-2 shrink-0">
                {item.count} {valueLabel}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-2 bg-gradient-to-r ${colorClass} rounded-full transition-all`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
