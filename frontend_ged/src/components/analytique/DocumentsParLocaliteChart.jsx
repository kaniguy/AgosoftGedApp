"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function DocumentsParLocaliteChart({
  data = [],
  activeLocaliteId = "",
  onLocaliteClick,
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  const truncated = data.map((d) => ({
    ...d,
    labelShort: d.localite.length > 22 ? d.localite.slice(0, 20) + "…" : d.localite,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={truncated}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="labelShort" type="category" width={130} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, _n, props) => [value + " doc(s)", props.payload.localite]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Bar
          dataKey="count"
          fill="#f97316"
          radius={[0, 4, 4, 0]}
          onClick={(entry) => onLocaliteClick?.(String(entry.localite_id))}
          style={{ cursor: onLocaliteClick ? "pointer" : "default" }}
        >
          {truncated.map((entry) => (
            <Cell
              key={entry.localite_id}
              fill="#f97316"
              opacity={
                activeLocaliteId && String(entry.localite_id) !== activeLocaliteId ? 0.35 : 1
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
