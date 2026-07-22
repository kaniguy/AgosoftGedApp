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

const GRADIENT_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#f59e0b", "#f97316", "#10b981", "#06b6d4",
  "#3b82f6", "#ec4899",
];

export default function DocumentsParTypeChart({
  data = [],
  activeTypeId = "",
  onTypeClick,
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
    typeShort: d.type.length > 20 ? d.type.slice(0, 18) + "…" : d.type,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={truncated}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis
          dataKey="typeShort"
          type="category"
          width={120}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, _name, props) => [value + " doc(s)", props.payload.type]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          onClick={(entry) => onTypeClick?.(String(entry.type_id))}
          style={{ cursor: onTypeClick ? "pointer" : "default" }}
        >
          {truncated.map((entry, index) => (
            <Cell
              key={entry.type_id ?? index}
              fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]}
              opacity={
                activeTypeId && String(entry.type_id) !== activeTypeId ? 0.35 : 1
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
