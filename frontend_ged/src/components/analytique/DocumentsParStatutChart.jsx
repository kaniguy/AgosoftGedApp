"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartEmpty } from "./AnalytiqueShared";

const COLORS = {
  brouillon: "#94a3b8",
  en_attente: "#f59e0b",
  valide: "#10b981",
  rejete: "#f43f5e",
};

export default function DocumentsParStatutChart({
  data = [],
  activeStatut = "",
  onStatutClick,
}) {
  const chartData = data.map((item) => ({
    name: item.label,
    value: item.count,
    statut: item.statut,
  }));

  if (chartData.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={false}
          onClick={(entry) => onStatutClick?.(entry.statut)}
          style={{ cursor: onStatutClick ? "pointer" : "default" }}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.statut}
              fill={COLORS[entry.statut] || "#6366f1"}
              stroke={activeStatut === entry.statut ? "#1e293b" : "transparent"}
              strokeWidth={activeStatut === entry.statut ? 3 : 0}
              opacity={activeStatut && activeStatut !== entry.statut ? 0.45 : 1}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [value + " document(s)", name]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
