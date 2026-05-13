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
  LabelList,
} from "recharts";
import { fundColor, PALETTE } from "@/lib/colors";
import type { CaptacaoRealData, TaxaSucessoAnoRow } from "@/types/mercado";

interface Props {
  data: CaptacaoRealData;
  dataBase?: string | null;
}

const fmtBR = (v: number) => v.toLocaleString("pt-BR");
const fmtBilhao = (v: number) => {
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} M`;
  return `R$ ${fmtBR(v)}`;
};
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function shortenName(s: string, max = 32) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Agrupa rows de taxa_sucesso por tipo_fundo, retornando um objeto por ano
function buildChartData(rows: TaxaSucessoAnoRow[], tipo: string) {
  return rows
    .filter((r) => r.tipo_fundo === tipo)
    .map((r) => ({
      ano: String(r.ano),
      Ofertadas: r.n_ofertadas,
      Encerradas: r.n_encerradas,
      taxa: r.taxa_sucesso,
    }));
}

const CLASSES = ["Cotas de FIDC", "Cotas de FIP", "Cotas de FII", "Consolidado"] as const;
const CLASS_LABEL: Record<string, string> = {
  "Cotas de FIDC": "FIDC",
  "Cotas de FIP": "FIP",
  "Cotas de FII": "FII",
  "Consolidado": "Consolidado",
};

function TaxaChart({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: { ano: string; Ofertadas: number; Encerradas: number; taxa: number }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ background: color }}
        >
          {fmtPct(rows[rows.length - 1]?.taxa ?? 0)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(v: unknown, name: unknown) => [
              `${(v as number).toLocaleString("pt-BR")} ofertas`,
              name as string,
            ]}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Ofertadas" fill={PALETTE.grayLight} radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="Ofertadas"
              position="top"
              style={{ fontSize: 9, fill: "#6b7280" }}
            />
          </Bar>
          <Bar dataKey="Encerradas" fill={color} radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="Encerradas"
              position="top"
              style={{ fontSize: 9, fill: color }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-around border-t border-gray-50 pt-2">
        {rows.map((r) => (
          <div key={r.ano} className="text-center">
            <p className="text-[10px] text-gray-400">{r.ano}</p>
            <p
              className="text-xs font-bold"
              style={{
                color:
                  r.taxa >= 80 ? PALETTE.secondary : r.taxa >= 60 ? PALETTE.amber : "#dc2626",
              }}
            >
              {fmtPct(r.taxa)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CLASS_COLORS: Record<string, string> = {
  "Cotas de FIDC": PALETTE.primary,
  "Cotas de FIP": PALETTE.gray,
  "Cotas de FII": PALETTE.secondary,
  Consolidado: PALETTE.amber,
};

export function CaptacaoRealSection({ data, dataBase }: Props) {
  const temAnbima = data.cobertura_anbima > 0;

  // Linha de tendência consolidada: taxa_sucesso por ano
  const consolidadoData = useMemo(
    () =>
      data.taxa_sucesso
        .filter((r) => r.tipo_fundo === "Consolidado")
        .map((r) => ({
          ano: String(r.ano),
          taxa: r.taxa_sucesso,
          n_ofertadas: r.n_ofertadas,
          n_encerradas: r.n_encerradas,
        })),
    [data.taxa_sucesso]
  );

  // Dados por classe para os mini-gráficos
  const chartsByClass = useMemo(
    () =>
      (["Cotas de FIDC", "Cotas de FIP", "Cotas de FII"] as const).map((tipo) => ({
        tipo,
        rows: buildChartData(data.taxa_sucesso, tipo),
      })),
    [data.taxa_sucesso]
  );

  // Tabela resumo: ano × classe
  const anos = useMemo(
    () => [...new Set(data.taxa_sucesso.map((r) => r.ano))].sort(),
    [data.taxa_sucesso]
  );

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#0F3443]">
          Taxa de Sucesso das Ofertas — Ofertadas × Encerradas
        </h2>
        <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
          FIDC · FII · FIP · últimos 3 anos
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
          Fonte: CVM
        </span>
        {temAnbima && (
          <span className="rounded-full bg-[#3F7957]/12 px-2.5 py-0.5 text-[11px] font-medium text-[#3F7957]">
            + ANBIMA Feed proxy ({data.cobertura_anbima.toLocaleString("pt-BR")} com dados)
          </span>
        )}
      </div>

      <p className="-mt-2 text-xs text-gray-500">
        Taxa de sucesso = quantidade encerrada / quantidade ofertada no ano.
        Uma oferta "encerrada" significa que saiu do status ativo (concluída, cancelada ou expirada).
        {dataBase && (
          <span className="ml-1 font-medium text-gray-600">· Data base: {dataBase}</span>
        )}
      </p>

      {/* Linha de tendência consolidada */}
      {consolidadoData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Consolidado — Taxa de encerramento por ano
            </h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
              style={{ background: PALETTE.amber }}
            >
              {fmtPct(consolidadoData[consolidadoData.length - 1]?.taxa ?? 0)} (último ano)
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-400">
            Total de ofertas iniciadas vs encerradas. Inclui FIDC + FII + FIP.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={consolidadoData}
              margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="ano"
                tick={{ fontSize: 12, fill: "#4b5563" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(v: unknown, name: unknown) => [
                  `${(v as number).toLocaleString("pt-BR")} ofertas`,
                  name as string,
                ]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="n_ofertadas" name="Ofertadas" fill={PALETTE.grayLight} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="n_ofertadas"
                  position="top"
                  style={{ fontSize: 11, fill: "#6b7280" }}
                />
              </Bar>
              <Bar dataKey="n_encerradas" name="Encerradas" fill={PALETTE.amber} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="n_encerradas"
                  position="top"
                  style={{ fontSize: 11, fill: PALETTE.amber }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Taxas por ano embaixo do gráfico */}
          <div className="mt-3 flex justify-around border-t border-gray-100 pt-3">
            {consolidadoData.map((r) => (
              <div key={r.ano} className="text-center">
                <p className="text-xs text-gray-400">{r.ano}</p>
                <p
                  className="mt-0.5 text-lg font-bold"
                  style={{
                    color:
                      r.taxa >= 80
                        ? PALETTE.secondary
                        : r.taxa >= 60
                          ? PALETTE.amber
                          : "#dc2626",
                  }}
                >
                  {fmtPct(r.taxa)}
                </p>
                <p className="text-[10px] text-gray-400">taxa de encerramento</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini-gráficos por classe */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {chartsByClass.map(({ tipo, rows }) => (
          <TaxaChart
            key={tipo}
            title={CLASS_LABEL[tipo]}
            color={CLASS_COLORS[tipo]}
            rows={rows}
          />
        ))}
      </div>

      {/* Tabela resumo: taxa de sucesso por ano × classe */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2.5 font-medium">Classe</th>
              {anos.map((a) => (
                <th key={a} className="px-4 py-2.5 text-center font-medium" colSpan={2}>
                  {a}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-1.5" />
              {anos.flatMap((a) => [
                <th key={`${a}-of`} className="px-3 py-1.5 text-right font-normal">Ofert.</th>,
                <th key={`${a}-enc`} className="px-3 py-1.5 text-right font-normal">Enc. (taxa)</th>,
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {CLASSES.map((tipo) => {
              const isCons = tipo === "Consolidado";
              return (
                <tr
                  key={tipo}
                  className={`hover:bg-gray-50 ${isCons ? "border-t-2 border-gray-200 font-semibold" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    {isCons ? (
                      <span className="text-sm font-semibold text-gray-800">Consolidado</span>
                    ) : (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: fundColor(tipo) }}
                      >
                        {tipo}
                      </span>
                    )}
                  </td>
                  {anos.map((ano) => {
                    const row = data.taxa_sucesso.find(
                      (r) => r.ano === ano && r.tipo_fundo === tipo
                    );
                    return [
                      <td key={`${ano}-of`} className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                        {row ? fmtBR(row.n_ofertadas) : "—"}
                      </td>,
                      <td
                        key={`${ano}-enc`}
                        className="px-3 py-2.5 text-right tabular-nums"
                        style={{
                          color: row
                            ? row.taxa_sucesso >= 80
                              ? PALETTE.secondary
                              : row.taxa_sucesso >= 60
                                ? PALETTE.amber
                                : "#dc2626"
                            : "#9ca3af",
                          fontWeight: row ? 600 : 400,
                        }}
                      >
                        {row ? `${fmtBR(row.n_encerradas)} (${fmtPct(row.taxa_sucesso)})` : "—"}
                      </td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Proxy ANBIMA de captação — só quando disponível */}
      {temAnbima && data.top_sub.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <h3 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">
            Top 20 maior gap ofertado vs captado (ANBIMA proxy)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Emissor</th>
                <th className="px-4 py-2.5 font-medium">Classe</th>
                <th className="px-4 py-2.5 font-medium">Encerramento</th>
                <th className="px-4 py-2.5 text-right font-medium">Ofertado</th>
                <th className="px-4 py-2.5 text-right font-medium">Captado</th>
                <th className="px-4 py-2.5 text-right font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.top_sub.map((r) => (
                <tr key={r.numero_processo} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span
                      className="block max-w-[280px] truncate font-medium text-[#0F3443]"
                      title={r.emissor_nome}
                    >
                      {shortenName(r.emissor_nome, 38)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ background: fundColor(r.tipo_fundo) }}
                    >
                      {r.tipo_fundo}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                    {r.data_encerramento}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtBilhao(r.valor_ofertado)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {fmtBilhao(r.delta_pl)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-red-600">
                    {fmtPct(r.taxa_captacao * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </section>
  );
}
