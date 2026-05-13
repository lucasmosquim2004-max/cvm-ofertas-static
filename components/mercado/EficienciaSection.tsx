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
  Cell,
  LabelList,
} from "recharts";
import { fundColor } from "@/lib/colors";
import type { EficienciaData } from "@/types/mercado";

interface Props {
  data: EficienciaData;
  dataBase?: string | null;
}

export function EficienciaSection({ data, dataBase }: Props) {
  const diasMedios = useMemo(() => {
    const acc = new Map<string, { soma: number; peso: number }>();
    data.dias.forEach((r) => {
      if (r.dias_medio_captacao == null || r.encerradas <= 0) return;
      const cur = acc.get(r.tipo_fundo) ?? { soma: 0, peso: 0 };
      cur.soma += r.dias_medio_captacao * r.encerradas;
      cur.peso += r.encerradas;
      acc.set(r.tipo_fundo, cur);
    });
    return Array.from(acc.entries())
      .map(([tipo_fundo, v]) => ({
        tipo_fundo,
        dias: v.peso > 0 ? +(v.soma / v.peso).toFixed(1) : 0,
      }))
      .filter((r) => r.dias > 0)
      .sort((a, b) => b.dias - a.dias);
  }, [data.dias]);

  const ticketAtual = useMemo(
    () =>
      data.ticket_atual
        .filter((r) => r.ticket_medio > 0)
        .sort((a, b) => b.ticket_medio - a.ticket_medio),
    [data.ticket_atual]
  );

  const anoAtual = new Date().getFullYear();

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#0F3443]">
          Métricas de Captação
        </h2>
        <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
          FIDC · FII · FIP
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">
            Dias médios de captação por tipo
          </h3>
          <p className="mb-4 text-xs text-gray-400">
            Tempo entre data início e encerramento (média ponderada, todos os
            anos)
            {dataBase && (
              <span className="ml-2 font-medium text-gray-500">· Data base: {dataBase}</span>
            )}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={diasMedios}
              layout="vertical"
              margin={{ top: 2, right: 56, left: 4, bottom: 2 }}
              barSize={22}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                horizontal={false}
              />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="tipo_fundo"
                width={100}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
                formatter={(v: number) => [`${v.toFixed(1)} dias`, "Média"]}
              />
              <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
                {diasMedios.map((d, i) => (
                  <Cell key={i} fill={fundColor(d.tipo_fundo)} />
                ))}
                <LabelList
                  dataKey="dias"
                  position="right"
                  style={{ fontSize: 11, fill: "#374151" }}
                  formatter={(v: number) => `${v.toFixed(0)}d`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">
            Ticket médio por tipo ({anoAtual})
          </h3>
          <p className="mb-4 text-xs text-gray-400">
            Volume médio por oferta no ano em curso (R$ M)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={ticketAtual}
              layout="vertical"
              margin={{ top: 2, right: 64, left: 4, bottom: 2 }}
              barSize={22}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                horizontal={false}
              />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="tipo_fundo"
                width={100}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
                formatter={(v: number, _n, p) => [
                  `R$ ${v.toFixed(1)}M`,
                  `Ticket médio (n=${p?.payload?.n ?? "?"})`,
                ]}
              />
              <Bar dataKey="ticket_medio" radius={[0, 4, 4, 0]}>
                {ticketAtual.map((d, i) => (
                  <Cell key={i} fill={fundColor(d.tipo_fundo)} />
                ))}
                <LabelList
                  dataKey="ticket_medio"
                  position="right"
                  style={{ fontSize: 11, fill: "#374151" }}
                  formatter={(v: number) => `R$ ${v.toFixed(0)}M`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
