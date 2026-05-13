"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SummaryData } from "@/types/oferta";

const COLORS: Record<string, string> = {
  FIDC: "#1e3a5f",
  "FIDC NP": "#2d5a9e",
  FII: "#2d6a4f",
  FIP: "#7c3aed",
  FICFIDC: "#64748b",
  FICFIP: "#94a3b8",
};

const DEFAULT_COLOR = "#cbd5e1";

interface Props {
  por_tipo: SummaryData["por_tipo"];
}

export function FundTypeChart({ por_tipo }: Props) {
  const data = por_tipo.map((r) => ({
    name: r.tipo_fundo,
    value: r.n,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-gray-700">
        Distribuição por Tipo (12 meses)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={COLORS[entry.name] ?? DEFAULT_COLOR}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              value.toLocaleString("pt-BR"),
              "Ofertas",
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
