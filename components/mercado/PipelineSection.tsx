"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import { PALETTE } from "@/lib/colors";
import type { PipelineData } from "@/types/mercado";

interface Props {
  data: PipelineData;
  dataBase?: string | null;
}

const MES_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function PipelineSection({ data, dataBase }: Props) {
  const sazonalidade = useMemo(() => {
    return data.sazonalidade
      .slice()
      .sort((a, b) => a.mes_num - b.mes_num)
      .map((r) => ({
        mes: MES_LABELS[r.mes_num - 1] ?? String(r.mes_num),
        media: r.media_por_ano,
      }));
  }, [data.sazonalidade]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#0F3443]">Sazonalidade</h2>
        <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
          FIDC · FII · FIP
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">
          Média histórica de ofertas por mês
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          Média de ofertas registradas em cada mês ao longo do histórico
          completo
          {dataBase && (
            <span className="ml-2 font-medium text-gray-500">· Data base: {dataBase}</span>
          )}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={sazonalidade}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number) => [
                `${v.toFixed(1)} ofertas/ano`,
                "Média",
              ]}
            />
            <Bar dataKey="media" fill={PALETTE.primary} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="media"
                position="top"
                style={{ fontSize: 11, fill: "#374151" }}
                formatter={(v: number) => v.toFixed(1)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
