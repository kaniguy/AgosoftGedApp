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

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];

const EVENT_TO_STATUT = {
  validation: "valide",
  rejet: "rejete",
  soumission: "en_attente",
  resoumission: "en_attente",
};

export default function WorkflowNotificationsChart({ data = [], onEventClick }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Aucune notification enregistrée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="label" type="category" width={160} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [value + " notification(s)", "Volume"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          onClick={(entry) => onEventClick?.(entry.event, EVENT_TO_STATUT[entry.event])}
          style={{ cursor: onEventClick ? "pointer" : "default" }}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
