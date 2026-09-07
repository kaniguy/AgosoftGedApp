"use client";

import { ChartEmpty } from "./AnalytiqueShared";

export default function RankingList({
  data = [],
  valueLabel = "actions",
  colorClass = "from-purple-500 to-purple-300",
  emptyMessage = "Aucune donnée disponible",
  onItemClick,
  activeKey = "",
}) {
  if (data.length === 0) {
    return <ChartEmpty title={emptyMessage} />;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const key = String(item.id ?? item.utilisateur ?? item.groupe ?? index);
        const isActive = activeKey && String(activeKey) === key;
        const Tag = onItemClick ? "button" : "div";
        return (
          <Tag
            key={key}
            type={onItemClick ? "button" : undefined}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
            className={`
              flex items-center gap-3 w-full text-left rounded-lg px-1 py-0.5 -mx-1
              ${onItemClick ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}
              ${isActive ? "bg-purple-50 ring-1 ring-purple-200" : ""}
            `}
          >
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
          </Tag>
        );
      })}
    </div>
  );
}
