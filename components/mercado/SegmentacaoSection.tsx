"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { publicoColor, YEAR_COMPARE_COLORS, PALETTE } from "@/lib/colors";
import type { SegmentacaoData } from "@/types/mercado";

interface Props {
  data: SegmentacaoData;
  dataBase?: string | null;
}

const PIE_PALETTE = [
  PALETTE.primary,
  PALETTE.secondary,
  PALETTE.gray,
  PALETTE.amber,
  PALETTE.primaryMid,
  PALETTE.secondaryMid,
  PALETTE.grayDark,
  PALETTE.amberLight,
  PALETTE.primaryLight,
  PALETTE.secondaryLight,
  PALETTE.grayLight,
];

const TOP_N = 10;

const fmtBR = (v: number) => v.toLocaleString("pt-BR");
const fmtBRdec = (v: number, dec = 1) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

function buildTopComparison<T extends { ano: number }>(
  rows: T[],
  anos: number[],
  nomeKey: keyof T,
  valueKey: keyof T
): { nome: string; data: Record<number, number>; total: number }[] {
  const acc = new Map<
    string,
    { porAno: Record<number, number>; total: number }
  >();
  for (const r of rows) {
    const nome = String(r[nomeKey] ?? "");
    if (!nome) continue;
    const v = Number(r[valueKey] ?? 0);
    const cur = acc.get(nome) ?? {
      porAno: Object.fromEntries(anos.map((a) => [a, 0])) as Record<
        number,
        number
      >,
      total: 0,
    };
    cur.porAno[r.ano] = (cur.porAno[r.ano] ?? 0) + v;
    cur.total += v;
    acc.set(nome, cur);
  }
  return Array.from(acc.entries())
    .map(([nome, v]) => ({ nome, data: v.porAno, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

function shortenName(s: string, max = 18) {
  if (s.length <= max) return s;
  // Pega primeiras palavras significativas
  const parts = s.split(/\s+/);
  let out = "";
  for (const p of parts) {
    if ((out + " " + p).length > max) break;
    out = out ? `${out} ${p}` : p;
  }
  return out || s.slice(0, max - 1) + "…";
}

export function SegmentacaoSection({ data, dataBase }: Props) {
  const publicoStacked = useMemo(() => {
    const filtered = data.publico_alvo.filter((r) => r.ano >= 2023);
    const publicos = Array.from(
      new Set(filtered.map((r) => r.publico_alvo))
    ).sort();
    const anos = Array.from(new Set(filtered.map((r) => r.ano))).sort(
      (a, b) => a - b
    );
    const bars = anos.map((ano) => {
      const row: Record<string, number | string> = { ano };
      for (const p of publicos) {
        const found = filtered.find(
          (r) => r.ano === ano && r.publico_alvo === p
        );
        row[p] = found ? found.n : 0;
      }
      return row;
    });
    return { publicos, bars };
  }, [data.publico_alvo]);

  const coordTop = useMemo(
    () =>
      buildTopComparison(
        data.coordenadores_3y,
        data.anos,
        "coordenador",
        "volume"
      ).map((c) => ({
        nome: shortenName(c.nome),
        nomeFull: c.nome,
        ...Object.fromEntries(
          data.anos.map((a) => [String(a), +(c.data[a] / 1e6).toFixed(1)])
        ),
      })),
    [data.coordenadores_3y, data.anos]
  );

  const gestTop = useMemo(
    () =>
      buildTopComparison(data.gestores_3y, data.anos, "gestor", "n").map(
        (g) => ({
          nome: shortenName(g.nome),
          nomeFull: g.nome,
          ...Object.fromEntries(
            data.anos.map((a) => [String(a), g.data[a] ?? 0])
          ),
        })
      ),
    [data.gestores_3y, data.anos]
  );

  const lastroPie = useMemo(() => {
    const top = data.lastro.slice(0, 10);
    const rest = data.lastro.slice(10);
    const restTotal = rest.reduce((a, r) => a + r.n, 0);
    const arr = top.map((r) => ({ name: r.tipo_lastro, value: r.n }));
    if (restTotal > 0) arr.push({ name: "Outros", value: restTotal });
    return arr;
  }, [data.lastro]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#0F3443]">
          Segmentação de Mercado
        </h2>
        <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
          FIDC · FII · FIP (exceto lastro)
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">
          Público-alvo por ano
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          Disponível apenas para ofertas registradas via Res. CVM 160 (a partir
          de 2023)
          {dataBase && (
            <span className="ml-2 font-medium text-gray-500">· Data base: {dataBase}</span>
          )}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={publicoStacked.bars}
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
              tickFormatter={(v: number) => fmtBR(v)}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number, name: string) => [fmtBR(v), name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            {publicoStacked.publicos.map((p) => (
              <Bar key={p} dataKey={p} stackId="a" fill={publicoColor(p)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">
          Top Coordenadores por Volume — comparativo anual
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          Top {TOP_N} ranqueados pelo total dos últimos 3 anos · valores em R$
          milhões
        </p>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={coordTop}
            margin={{ top: 16, right: 16, left: 8, bottom: 80 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 10, fill: "#4b5563" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={70}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$ ${fmtBR(v)}M`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              labelFormatter={(_label: unknown, payload: unknown[]) =>
                (payload?.[0] as { payload?: { nomeFull?: string } } | undefined)?.payload?.nomeFull ?? ""
              }
              formatter={(v: number, name) => [
                `R$ ${fmtBRdec(v, 1)}M`,
                String(name),
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            {data.anos.map((ano, i) => (
              <Bar
                key={ano}
                dataKey={String(ano)}
                fill={YEAR_COMPARE_COLORS[i] ?? PALETTE.primary}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">
          Top Gestores por Nº de Ofertas — comparativo anual
        </h3>
        <p className="mb-4 text-xs text-gray-400">
          Top {TOP_N} ranqueados pelo total dos últimos 3 anos
        </p>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={gestTop}
            margin={{ top: 16, right: 16, left: 8, bottom: 80 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 10, fill: "#4b5563" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={70}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => fmtBR(v)}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              labelFormatter={(_label: unknown, payload: unknown[]) =>
                (payload?.[0] as { payload?: { nomeFull?: string } } | undefined)?.payload?.nomeFull ?? ""
              }
              formatter={(v: number, name) => [fmtBR(v), String(name)]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            {data.anos.map((ano, i) => (
              <Bar
                key={ano}
                dataKey={String(ano)}
                fill={YEAR_COMPARE_COLORS[i] ?? PALETTE.primary}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">Tipo de Lastro</h3>
        <p className="mb-4 text-xs text-gray-400">
          Distribuição em ofertas Res. CVM 160 (top 10 + Outros)
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={lastroPie}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {lastroPie.map((_, i) => (
                <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v: number) => [fmtBR(v), "Ofertas"]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
