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
import { formatDateFr, formatPeriodeBucket } from "../../utils/printReport";

const SERIES = [
  { key: "valide", label: "Validés", color: "#10b981" },
  { key: "en_attente", label: "En attente", color: "#f59e0b" },
  { key: "rejete", label: "Rejetés", color: "#f43f5e" },
];

function tooltipLabel(periode, granularite) {
  if (granularite === "jour") return formatDateFr(periode);
  if (granularite === "semaine") return `Semaine du ${formatDateFr(periode)}`;
  return formatPeriodeBucket(periode, granularite);
}

export default function EvolutionStackedChart({ data = [], granularite = "mois", activeStatut = "" }) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatPeriodeBucket(d.periode, granularite),
    tooltip: tooltipLabel(d.periode, granularite),
  }));

  if (chartData.length === 0 || chartData.every((d) => !d.total)) {
    return <ChartEmpty />;
  }

  const visibleSeries = activeStatut
    ? SERIES.filter((s) => s.key === activeStatut)
    : SERIES;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltip ?? ""}
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
