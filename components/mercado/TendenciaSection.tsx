"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { fundColor } from "@/lib/colors";
import type { TendenciaData } from "@/types/mercado";

interface Props {
  data: TendenciaData;
  dataBase?: string | null;
}

const MES_LABELS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatMes(mes: string) {
  const [y, m] = mes.split("-");
  return `${MES_LABELS[parseInt(m) - 1]}/${y.slice(2)}`;
}

export function TendenciaSection({ data, dataBase }: Props) {
  const [tab, setTab] = useState<"anual" | "mensal">("anual");

  const { tipos, anualBars } = useMemo(() => {
    const tiposSet = new Set<string>();
    data.anual.forEach((r) => tiposSet.add(r.tipo_fundo));
    const tipos = Array.from(tiposSet).sort();
    const anos = Array.from(new Set(data.anual.map((r) => r.ano))).sort(
      (a, b) => a - b
    );
    const bars = anos.map((ano) => {
      const row: Record<string, number | string> = { ano };
      for (const t of tipos) {
        const found = data.anual.find(
          (r) => r.ano === ano && r.tipo_fundo === t
        );
        row[t] = found ? +(found.volume / 1e9).toFixed(2) : 0;
      }
      return row;
    });
    return { tipos, anualBars: bars };
  }, [data.anual]);

  const mensalBars = useMemo(() => {
    const meses = Array.from(new Set(data.mensal.map((r) => r.mes))).sort();
    return meses.map((mes) => {
      const row: Record<string, number | string> = { mes: formatMes(mes) };
      for (const t of tipos) {
        const found = data.mensal.find(
          (r) => r.mes === mes && r.tipo_fundo === t
        );
        row[t] = found ? +(found.volume / 1e9).toFixed(2) : 0;
      }
      return row;
    });
  }, [data.mensal, tipos]);

  const ticketLine = useMemo(() => {
    const anos = Array.from(new Set(data.ticket.map((r) => r.ano))).sort(
      (a, b) => a - b
    );
    const tiposTicket = Array.from(
      new Set(data.ticket.map((r) => r.tipo_fundo))
    ).sort();
    const series = anos.map((ano) => {
      const row: Record<string, number | string> = { ano };
      for (const t of tiposTicket) {
        const found = data.ticket.find(
          (r) => r.ano === ano && r.tipo_fundo === t
        );
        row[t] = found && found.ticket_medio > 0 ? found.ticket_medio : 0;
      }
      return row;
    });
    return { tiposTicket, series };
  }, [data.ticket]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-[#0F3443]">
            Histórico de Volume
          </h2>
          <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
            FIDC · FII · FIP
          </span>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setTab("anual")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === "anual"
                ? "bg-[#0F3443] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Anual
          </button>
          <button
            onClick={() => setTab("mensal")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === "mensal"
                ? "bg-[#0F3443] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Mensal (12m)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          Volume emitido (R$ bi)
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          {tab === "anual"
            ? "Empilhado por tipo de fundo, 2019–hoje"
            : "Últimos 12 meses, empilhado por tipo de fundo"}
          {dataBase && (
            <span className="ml-2 font-medium text-gray-500">· Data base: {dataBase}</span>
          )}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={tab === "anual" ? anualBars : mensalBars}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={tab === "anual" ? "ano" : "mes"}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "R$ bi",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "#9ca3af" },
              }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number, name: string) => [
                `R$ ${v.toFixed(2)} bi`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            {tipos.map((t) => (
              <Bar key={t} dataKey={t} stackId="a" fill={fundColor(t)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          Ticket médio por oferta (R$ M) — evolução
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          Volume médio por oferta em cada ano · mostra se o mercado caminha
          para deals maiores ou menores
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={ticketLine.series}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="ano"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$ ${v}M`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number, name: string) => [
                `R$ ${v.toFixed(1)}M`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            {ticketLine.tiposTicket.map((t) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={fundColor(t)}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
