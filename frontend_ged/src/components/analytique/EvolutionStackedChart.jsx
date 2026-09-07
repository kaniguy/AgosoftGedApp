"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartEmpty } from "./AnalytiqueShared";

const SERIES = [
  { key: "valide", label: "Validés", color: "#10b981" },
  { key: "en_attente", label: "En attente", color: "#f59e0b" },
  { key: "rejete", label: "Rejetés", color: "#f43f5e" },
];

function formatMois(str) {
  if (!str) return "";
  const [year, month] = str.split("-");
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
}

export default function EvolutionStackedChart({ data = [], activeStatut = "" }) {
  const chartData = data.map((d) => ({
    ...d,
    moisLabel: formatMois(d.mois),
  }));

  if (chartData.length === 0) {
    return <ChartEmpty />;
  }

  const visibleSeries = activeStatut
    ? SERIES.filter((s) => s.key === activeStatut)
    : SERIES;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="moisLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {visibleSeries.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId="1"
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
