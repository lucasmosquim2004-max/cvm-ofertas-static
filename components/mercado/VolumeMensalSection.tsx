"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { mobiliarioColor } from "@/lib/colors";
import type { VolumeMensalData } from "@/types/mercado";

interface Props {
  data: VolumeMensalData;
  dataBase?: string | null;
}

const TOP_N_AGRUPADO = 7;

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

function formatMes(mes: string) {
  const [y, m] = mes.split("-");
  return `${MES_LABELS[parseInt(m) - 1]}/${y.slice(2)}`;
}

const fmtBR = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function formatBilhao(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}B`;
  if (v >= 1e6) return `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (v >= 1e3) return `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}K`;
  return fmtBR(v);
}

function formatBRLFull(v: number): string {
  return `R$ ${formatBilhao(v)}`;
}

export function VolumeMensalSection({ data, dataBase }: Props) {
  const [modo, setModo] = useState<"agrupado" | "detalhado">("agrupado");

  // Agrega por Valor_Mobiliario para ranquear
  const totalsPorVM = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) {
      m.set(r.valor_mobiliario, (m.get(r.valor_mobiliario) ?? 0) + r.volume);
    }
    return Array.from(m.entries())
      .map(([nome, vol]) => ({ nome, vol }))
      .sort((a, b) => b.vol - a.vol);
  }, [data.rows]);

  // Decide categorias visíveis com base no modo
  const categorias = useMemo(() => {
    if (modo === "detalhado") {
      return totalsPorVM.map((x) => x.nome);
    }
    const top = totalsPorVM.slice(0, TOP_N_AGRUPADO).map((x) => x.nome);
    if (totalsPorVM.length > TOP_N_AGRUPADO) top.push("Outros");
    return top;
  }, [totalsPorVM, modo]);

  // Constrói matriz mês × categoria
  const chartRows = useMemo(() => {
    const meses = Array.from(new Set(data.rows.map((r) => r.mes))).sort();
    const topSet =
      modo === "agrupado"
        ? new Set(totalsPorVM.slice(0, TOP_N_AGRUPADO).map((x) => x.nome))
        : null;
    return meses.map((mes) => {
      const linha: Record<string, number | string> = { mes };
      let total = 0;
      for (const r of data.rows) {
        if (r.mes !== mes) continue;
        const cat =
          modo === "detalhado" || (topSet && topSet.has(r.valor_mobiliario))
            ? r.valor_mobiliario
            : "Outros";
        linha[cat] = ((linha[cat] as number) ?? 0) + r.volume;
        total += r.volume;
      }
      linha.__total = total;
      linha.__label = formatMes(mes);
      return linha;
    });
  }, [data.rows, modo, totalsPorVM]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-[#0F3443]">
              Volume Mensal Registrado (24 meses)
            </h2>
            <span className="rounded-full bg-[#3F7957]/12 px-2.5 py-0.5 text-[11px] font-medium text-[#3F7957]">
              Todas as classes (CVM 160)
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Inclui Cotas de FIDC/FII/FIP/FIAGRO/FIF + Debêntures + CRI + CRA +
            Notas Comerciais. Fonte:{" "}
            <span className="font-medium">CVM 160 / Valor Mobiliário</span>
            {dataBase && (
              <span className="ml-2 font-medium text-gray-600">· Data base: {dataBase}</span>
            )}
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setModo("agrupado")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              modo === "agrupado"
                ? "bg-[#0F3443] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Agrupado
          </button>
          <button
            onClick={() => setModo("detalhado")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              modo === "detalhado"
                ? "bg-[#0F3443] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Detalhado
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart
            data={chartRows}
            margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="__label"
              tick={{ fontSize: 11, fill: "#4b5563" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              interval={0}
              angle={chartRows.length > 18 ? -30 : 0}
              textAnchor={chartRows.length > 18 ? "end" : "middle"}
              height={chartRows.length > 18 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatBilhao(v)}
              width={64}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number, name: string) => [
                formatBRLFull(v),
                name === "__total" ? "Total" : name,
              ]}
              labelFormatter={(l) => `Mês: ${l}`}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v: string) => (v === "__total" ? "Total" : v)}
            />
            {categorias.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="vol"
                fill={mobiliarioColor(cat, i)}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="__total"
              stroke="#0F3443"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "#0F3443" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
