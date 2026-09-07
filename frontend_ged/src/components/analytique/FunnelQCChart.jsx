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
import { ChartEmpty } from "./AnalytiqueShared";

const FUNNEL_COLORS = ["#f59e0b", "#10b981", "#f43f5e"];

export default function FunnelQCChart({ data = [], activeStatut = "", onStatutClick }) {
  if (data.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="etape" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [value + " document(s)", "Volume"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          onClick={(entry) => onStatutClick?.(entry.statut)}
          style={{ cursor: onStatutClick ? "pointer" : "default" }}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.statut}
              fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
              opacity={activeStatut && activeStatut !== entry.statut ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
