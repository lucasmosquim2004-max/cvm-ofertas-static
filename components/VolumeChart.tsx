"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SummaryData } from "@/types/oferta";

interface Props {
  por_mes: SummaryData["por_mes"];
}

function shortMonth(mes: string): string {
  const [y, m] = mes.split("-");
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

export function VolumeChart({ por_mes }: Props) {
  const data = por_mes.map((r) => ({
    mes: shortMonth(r.mes),
    ofertas: r.n,
    volume_bi: +(r.volume / 1e9).toFixed(2),
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-gray-700">
        Novas Ofertas por Mês (12 meses)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "ofertas"
                ? [value.toLocaleString("pt-BR"), "Ofertas"]
                : [`R$ ${value.toFixed(1)}B`, "Volume"]
            }
          />
          <Bar dataKey="ofertas" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
