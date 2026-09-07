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

const COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#f43f5e",
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function ActionsParTypeChart({ data = [] }) {
  if (data.length === 0) {
    return <ChartEmpty />;
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
        <YAxis
          dataKey="label"
          type="category"
          width={110}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => [value + " action(s)", "Occurrences"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
