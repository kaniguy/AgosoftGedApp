"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartEmpty } from "./AnalytiqueShared";

function formatMois(str) {
  if (!str) return "";
  const [year, month] = str.split("-");
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
}

export function SimpleTrendChart({
  data = [],
  dataKey = "count",
  xKey = "mois",
  color = "#8b5cf6",
  formatX = formatMois,
  height = 220,
  valueLabel = "Valeur",
  onPointClick,
}) {
  const chartData = data.map((d) => ({
    ...d,
    xLabel: formatX(d[xKey]),
  }));

  if (chartData.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        onClick={(state) => {
          const payload = state?.activePayload?.[0]?.payload;
          if (payload && onPointClick) onPointClick(payload);
        }}
      >
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="xLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [value, valueLabel]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color})`}
          style={{ cursor: onPointClick ? "pointer" : "default" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatJour(str) {
  if (!str) return "";
  const [, month, day] = str.split("-");
  return `${day}/${month}`;
}

export function DailyTrendChart(props) {
  return (
    <SimpleTrendChart
      {...props}
      xKey="jour"
      formatX={formatJour}
      color="#8b5cf6"
    />
  );
}
