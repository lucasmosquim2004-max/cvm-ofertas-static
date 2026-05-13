"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatBRL } from "@/lib/utils";
import { fundColor, PALETTE } from "@/lib/colors";
import type { OverviewData } from "@/types/mercado";

interface Props {
  data: OverviewData;
}

function KPICard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "up" | "down" | null;
}) {
  const accentClass =
    accent === "up"
      ? "text-[#3F7957]"
      : accent === "down"
        ? "text-red-600"
        : "text-[#0F3443]";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${accentClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function buildStackedData(data: OverviewData) {
  const tipos = Array.from(new Set(data.rows.map((r) => r.tipo_fundo))).sort();
  const anos = Array.from(new Set(data.rows.map((r) => r.ano))).sort(
    (a, b) => a - b
  );
  const stacked = anos.map((ano) => {
    const row: Record<string, number | string> = { ano };
    for (const t of tipos) {
      const found = data.rows.find((r) => r.ano === ano && r.tipo_fundo === t);
      row[t] = found ? found.n : 0;
    }
    return row;
  });
  return { tipos, stacked };
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function MercadoOverview({ data }: Props) {
  const anoAtual = new Date().getFullYear();
  const { tipos, stacked } = buildStackedData(data);

  const yoyN = data.kpis.ytd_yoy_n ?? 0;
  const yoyVol = data.kpis.ytd_yoy_vol ?? 0;
  const today = formatDateBR(new Date());

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[#0F3443]">
          Visão Geral
        </h2>
        <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
          Universo: FIDC · FII · FIP
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          label={`Total de Ofertas (${anoAtual})`}
          value={data.kpis.total_ano.toLocaleString("pt-BR")}
          sub="FIDC · FII · FIP · ano em curso"
        />
        <KPICard
          label={`Volume Emitido (${anoAtual})`}
          value={formatBRL(data.kpis.volume_ano)}
          sub="FIDC · FII · FIP · ano em curso"
        />
        <KPICard
          label="YoY YTD (nº)"
          value={`${yoyN >= 0 ? "+" : ""}${yoyN.toFixed(1)}%`}
          sub={`FIDC · FII · FIP · jan–${today} ${anoAtual} vs jan–${today} ${anoAtual - 1}`}
          accent={yoyN >= 0 ? "up" : "down"}
        />
        <KPICard
          label="Ofertas Ativas"
          value={data.kpis.ativas_total.toLocaleString("pt-BR")}
          sub="FIDC · FII · FIP · em distribuição"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          Ofertas por ano por tipo (2019–hoje)
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          YoY YTD volume: {yoyVol >= 0 ? "+" : ""}
          {yoyVol.toFixed(1)}% — empilhado por tipo de fundo
          {data.data_base && (
            <span className="ml-2 font-medium text-gray-500">· Data base: {data.data_base}</span>
          )}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={stacked}
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
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number, name: string) => [
                v.toLocaleString("pt-BR"),
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
        <p className="mt-2 text-[11px] text-gray-400">
          Classificação CVM (Valor Mobiliário): legacy FIDC NP / FICFIDC /
          FICFIP consolidados em FIDC ou FIP
        </p>
      </div>
    </section>
  );
}
