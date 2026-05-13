"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const PALETTE = [
  "#2d6a4f",
  "#1e3a5f",
  "#40916c",
  "#2d5a9e",
  "#52b788",
  "#7c3aed",
  "#d97706",
  "#64748b",
  "#0891b2",
  "#dc2626",
];

const MAX_LABEL = 24;
function truncate(s: string) {
  return s.length > MAX_LABEL ? s.slice(0, MAX_LABEL - 1) + "…" : s;
}

export interface BarDataPoint {
  label: string;
  value: number;
}

interface Props {
  title: string;
  subtitle: string;
  data: BarDataPoint[];
  valueFormatter?: (v: number) => string;
}

export function HorizontalBarChart({ title, subtitle, data, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString("pt-BR"));
  const chartData = data.map((d) => ({ ...d, label: truncate(d.label) }));
  const barHeight = 28;
  const height = Math.max(160, chartData.length * barHeight + 20);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="mb-4 text-xs text-gray-400">{subtitle}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 2, right: 72, left: 4, bottom: 2 }}
          barSize={14}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={148}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number) => [fmt(v), ""]}
            labelStyle={{ fontWeight: 600, color: "#1e3a5f" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fill: "#374151" }}
              formatter={fmt}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
