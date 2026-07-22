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

function formatMois(str) {
  if (!str) return "";
  const [year, month] = str.split("-");
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
}

export default function EvolutionDocumentsChart({ data = [] }) {
  const chartData = data.map((d) => ({
    mois: formatMois(d.mois),
    count: d.count,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [value + " document(s)", "Documents créés"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#f97316"
          strokeWidth={2}
          fill="url(#colorDocs)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
