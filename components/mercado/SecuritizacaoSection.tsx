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
  LabelList,
} from "recharts";
import { PALETTE } from "@/lib/colors";
import type { SecuritizacaoData } from "@/types/mercado";

interface Props {
  data: SecuritizacaoData;
}

const TIPOS_CVM = ["FIDC", "FII", "FIP", "Debêntures"] as const;
const TIPOS_ANBIMA = ["FIDC", "FII", "Debêntures"] as const;

const TIPO_COLORS: Record<string, string> = {
  FIDC: PALETTE.primary,
  FII: PALETTE.secondary,
  FIP: PALETTE.gray,
  "Debêntures": PALETTE.amber,
};

const fmtBR = (v: number) => v.toLocaleString("pt-BR");
const fmtBi = (v: number) => {
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(0)} M`;
  return `R$ ${fmtBR(Math.round(v))}`;
};
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type Metrica = "quantidade" | "volume";
type Tab = "captacao" | "registradas";

export function SecuritizacaoSection({ data }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("volume");
  const [tab, setTab] = useState<Tab>("captacao");

  if (!data.disponivel) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[#0F3443]">
          Mercado de Capitais — FIDC · FII · FIP · Debêntures
        </h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">View de securitização não encontrada.</p>
          <p className="mt-2 text-xs">Rode o ETL Python para gerar os dados:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100/70 p-2 text-xs">
            cd cvm-ofertas{"\n"}python ofertas_monitor.py --enrich
          </pre>
        </div>
      </section>
    );
  }

  // ── Aba 1: Registradas × Encerradas (CVM, por ano de início) ─────────────
  const consolidadoChart = useMemo(
    () =>
      data.consolidado_ano.map((r) => ({
        ano: String(r.ano),
        Ofertadas: metrica === "quantidade" ? r.n_ofertadas : +(r.vol_ofertado / 1e9).toFixed(1),
        Encerradas: metrica === "quantidade" ? r.n_encerradas : +(r.vol_encerrado / 1e9).toFixed(1),
        taxa: r.taxa_encerramento,
      })),
    [data.consolidado_ano, metrica]
  );

  const chartByTipo = useMemo(
    () =>
      TIPOS_CVM.filter((tipo) => data.por_tipo_ano.some((r) => r.tipo_ativo === tipo)).map(
        (tipo) => ({
          tipo,
          rows: data.por_tipo_ano
            .filter((r) => r.tipo_ativo === tipo)
            .map((r) => ({
              ano: String(r.ano),
              Ofertadas: metrica === "quantidade" ? r.n_ofertadas : +(r.vol_ofertado / 1e9).toFixed(1),
              Encerradas: metrica === "quantidade" ? r.n_encerradas : +(r.vol_encerrado / 1e9).toFixed(1),
              taxa: r.taxa_encerramento,
            })),
        })
      ),
    [data.por_tipo_ano, metrica]
  );

  // ── Aba 2: Captação Efetiva (mesmo coorte: YEAR(data_encerramento)) ───────
  const captacaoConsolidado = useMemo(() => {
    const rows = data.captacao_consolidado ?? [];
    return rows.map((r) => {
      const dist = r.vol_encerrado_anbima;
      const ofertado = r.vol_ofertado_cvm;
      const pct = dist != null && ofertado > 0 ? +((dist / ofertado) * 100).toFixed(1) : null;
      return {
        ano: String(r.ano),
        "Volume Ofertado": +(ofertado / 1e9).toFixed(1),
        "Volume Encerrado": dist != null ? +(dist / 1e9).toFixed(1) : null,
        pct,
      };
    });
  }, [data.captacao_consolidado]);

  const captacaoByTipo = useMemo(() => {
    const rows = data.captacao_tipo_ano ?? [];
    return TIPOS_ANBIMA.filter((tipo) => rows.some((r) => r.tipo_ativo === tipo)).map((tipo) => ({
      tipo,
      rows: rows
        .filter((r) => r.tipo_ativo === tipo)
        .map((r) => {
          const dist = r.vol_encerrado_anbima;
          const ofertado = r.vol_ofertado_cvm;
          const pct = dist != null && ofertado > 0 ? +((dist / ofertado) * 100).toFixed(1) : null;
          return {
            ano: String(r.ano),
            "Volume Ofertado": +(ofertado / 1e9).toFixed(1),
            "Volume Encerrado": dist != null ? +(dist / 1e9).toFixed(1) : null,
            pct,
          };
        }),
    }));
  }, [data.captacao_tipo_ano]);

  const anosCaptacao = data.anos_captacao ?? data.anos;
  const yLabel = metrica === "quantidade" ? "operações" : "R$ bi";

  const anbimaBase = data.anbima_data_base ?? null;
  const cvmBase = data.cvm_data_base ?? null;
  const dataBaseCaptacao = [
    anbimaBase ? `ANBIMA: até ${anbimaBase}` : null,
    cvmBase ? `CVM: até ${cvmBase}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const dataBaseCvm = cvmBase ? `CVM: até ${cvmBase}` : null;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold text-[#0F3443]">
            Mercado de Capitais
          </h2>
          <span className="rounded-full bg-[#0F3443]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#0F3443]">
            FIDC · FII · FIP · Debêntures
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
            últimos 3 anos
          </span>
          {data.anbima_disponivel && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              + ANBIMA
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
          <button
            onClick={() => setTab("captacao")}
            className={`px-3 py-1.5 transition-colors ${
              tab === "captacao"
                ? "bg-[#0F3443] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Captação Efetiva
          </button>
          <button
            onClick={() => setTab("registradas")}
            className={`border-l border-gray-200 px-3 py-1.5 transition-colors ${
              tab === "registradas"
                ? "bg-[#0F3443] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Registradas × Encerradas
          </button>
        </div>
      </div>

      {/* ── TAB: Captação Efetiva ──────────────────────────────────────────── */}
      {tab === "captacao" && (
        <>
          {/* Legenda explicativa */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-800 space-y-1">
            <p>
              <strong>Volume Ofertado</strong>: valor registrado na CVM para ofertas encerradas no ano (sem lote adicional).
              &nbsp;<strong>Volume Encerrado</strong>: valor efetivamente distribuído aos investidores segundo o Boletim ANBIMA — inclui o lote adicional quando exercido.
            </p>
            <p>
              <strong>Por que pode ultrapassar 100%?</strong> Quando a demanda supera o volume inicial, o emissor pode exercer o lote adicional/suplementar (tipicamente até 20% a mais), fazendo o Volume Encerrado superar o Volume Ofertado registrado.
            </p>
            <p className="text-blue-600">
              Ambas as métricas usam <strong>ano de encerramento</strong> como referência (mesmo coorte de ofertas).
            </p>
          </div>


          {/* Gráfico consolidado captação */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Consolidado — Volume Ofertado vs Volume Encerrado (R$ bi)
              </h3>
              {captacaoConsolidado[captacaoConsolidado.length - 1]?.pct != null && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    background: PALETTE.secondary + "22",
                    color: PALETTE.secondary,
                  }}
                >
                  {fmtPct(captacaoConsolidado[captacaoConsolidado.length - 1]!.pct!)} captado (último ano)
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-gray-400">
              FIDC + FII + Debêntures · Fonte: CVM (ofertado) e ANBIMA Boletim MK (encerrado) · FIP sem dados ANBIMA
              {dataBaseCaptacao && (
                <span className="ml-2 font-medium text-gray-500">· {dataBaseCaptacao}</span>
              )}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={captacaoConsolidado}
                margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ano" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}B`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(v: unknown, name: unknown) => [
                    v != null ? `R$ ${(v as number).toFixed(1)} bi` : "—",
                    name as string,
                  ]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Volume Ofertado" fill={PALETTE.grayLight} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Volume Ofertado"
                    position="top"
                    style={{ fontSize: 11, fill: "#6b7280" }}
                    formatter={(v: unknown) => `${(v as number).toFixed(1)}`}
                  />
                </Bar>
                <Bar dataKey="Volume Encerrado" fill={PALETTE.secondary} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Volume Encerrado"
                    position="top"
                    style={{ fontSize: 11, fill: PALETTE.secondary }}
                    formatter={(v: unknown) => v != null ? `${(v as number).toFixed(1)}` : "—"}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex justify-around border-t border-gray-100 pt-3">
              {captacaoConsolidado.map((r) => (
                <div key={r.ano} className="text-center">
                  <p className="text-xs text-gray-400">{r.ano}</p>
                  {r.pct != null ? (
                    <>
                      <p
                        className="mt-0.5 text-lg font-bold"
                        style={{
                          color:
                            r.pct > 100
                              ? PALETTE.primary
                              : r.pct >= 80
                                ? PALETTE.secondary
                                : r.pct >= 50
                                  ? PALETTE.amber
                                  : "#dc2626",
                        }}
                      >
                        {fmtPct(r.pct)}
                        {r.pct > 100 && (
                          <span className="ml-1 text-[10px] font-normal text-blue-500">🔵</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {r.pct > 100 ? "incl. lote adicional" : "do volume ofertado"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm text-gray-300">sem ANBIMA</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mini-gráficos por tipo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {captacaoByTipo.map(({ tipo, rows }) => {
              const color = TIPO_COLORS[tipo] ?? PALETTE.gray;
              const ultimoPct = rows[rows.length - 1]?.pct;
              const acimaDe100 = ultimoPct != null && ultimoPct > 100;
              return (
                <div key={tipo} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">{tipo}</h4>
                    {ultimoPct != null && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{ background: acimaDe100 ? PALETTE.primary : color }}
                        title={acimaDe100 ? "Inclui lote adicional exercido" : undefined}
                      >
                        {fmtPct(ultimoPct)}{acimaDe100 ? " 🔵" : ""}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rows} margin={{ top: 18, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ano" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(v: unknown, name: unknown) => [
                          v != null ? `R$ ${(v as number).toFixed(1)} bi` : "—",
                          name as string,
                        ]}
                      />
                      <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Volume Ofertado" fill={PALETTE.grayLight} radius={[2, 2, 0, 0]}>
                        <LabelList
                          dataKey="Volume Ofertado"
                          position="top"
                          style={{ fontSize: 8, fill: "#9ca3af" }}
                          formatter={(v: unknown) => `${(v as number).toFixed(1)}`}
                        />
                      </Bar>
                      <Bar dataKey="Volume Encerrado" fill={color} radius={[2, 2, 0, 0]}>
                        <LabelList
                          dataKey="Volume Encerrado"
                          position="top"
                          style={{ fontSize: 8, fill: color }}
                          formatter={(v: unknown) => v != null ? `${(v as number).toFixed(1)}` : ""}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-around border-t border-gray-50 pt-2">
                    {rows.map((r) => (
                      <div key={r.ano} className="text-center">
                        <p className="text-[9px] text-gray-400">{r.ano}</p>
                        {r.pct != null ? (
                          <p
                            className="text-[11px] font-bold"
                            style={{
                              color:
                                r.pct > 100
                                  ? PALETTE.primary
                                  : r.pct >= 80
                                    ? PALETTE.secondary
                                    : r.pct >= 50
                                      ? PALETTE.amber
                                      : "#dc2626",
                            }}
                          >
                            {fmtPct(r.pct)}{r.pct > 100 ? " 🔵" : ""}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-300">—</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela resumo captação */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  {anosCaptacao.flatMap((ano) => [
                    <th key={`${ano}-meta`} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {ano} — Ofertado
                    </th>,
                    <th key={`${ano}-dist`} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      Encerrado (%)
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TIPOS_ANBIMA.map((tipo) => {
                  const color = TIPO_COLORS[tipo] ?? PALETTE.gray;
                  const hasData = (data.captacao_tipo_ano ?? []).some((r) => r.tipo_ativo === tipo);
                  if (!hasData) return null;
                  return (
                    <tr key={tipo} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: color }}
                        >
                          {tipo}
                        </span>
                      </td>
                      {anosCaptacao.flatMap((ano) => {
                        const r = (data.captacao_tipo_ano ?? []).find(
                          (x) => x.ano === ano && x.tipo_ativo === tipo
                        );
                        const meta = r ? fmtBi(r.vol_ofertado_cvm) : "—";
                        const dist =
                          r?.vol_encerrado_anbima != null
                            ? `${fmtBi(r.vol_encerrado_anbima)} (${fmtPct(
                                (r.vol_encerrado_anbima / r.vol_ofertado_cvm) * 100
                              )})`
                            : "—";
                        const pct =
                          r?.vol_encerrado_anbima != null && r.vol_ofertado_cvm > 0
                            ? (r.vol_encerrado_anbima / r.vol_ofertado_cvm) * 100
                            : null;
                        return [
                          <td key={`${ano}-meta`} className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {meta}
                          </td>,
                          <td
                            key={`${ano}-dist`}
                            className="px-3 py-2 text-right tabular-nums font-medium"
                            style={{
                              color:
                                pct == null
                                  ? "#9ca3af"
                                  : pct > 100
                                    ? PALETTE.primary
                                    : pct >= 80
                                      ? PALETTE.secondary
                                      : pct >= 50
                                        ? PALETTE.amber
                                        : "#dc2626",
                            }}
                          >
                            {dist}
                            {pct != null && pct > 100 && (
                              <span className="ml-1 text-[10px] text-blue-500">🔵</span>
                            )}
                          </td>,
                        ];
                      })}
                    </tr>
                  );
                })}
                {/* Consolidado */}
                <tr className="border-t-2 border-gray-200 font-semibold hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">Consolidado</td>
                  {anosCaptacao.flatMap((ano) => {
                    const r = (data.captacao_consolidado ?? []).find((x) => x.ano === ano);
                    const meta = r ? fmtBi(r.vol_ofertado_cvm) : "—";
                    const dist =
                      r?.vol_encerrado_anbima != null
                        ? `${fmtBi(r.vol_encerrado_anbima)} (${fmtPct(
                            (r.vol_encerrado_anbima / r.vol_ofertado_cvm) * 100
                          )})`
                        : "—";
                    const pct =
                      r?.vol_encerrado_anbima != null && r && r.vol_ofertado_cvm > 0
                        ? (r.vol_encerrado_anbima / r.vol_ofertado_cvm) * 100
                        : null;
                    return [
                      <td key={`${ano}-meta`} className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {meta}
                      </td>,
                      <td
                        key={`${ano}-dist`}
                        className="px-3 py-2.5 text-right tabular-nums font-bold"
                        style={{
                          color:
                            pct == null
                              ? "#9ca3af"
                              : pct > 100
                                ? PALETTE.primary
                                : pct >= 80
                                  ? PALETTE.secondary
                                  : pct >= 50
                                    ? PALETTE.amber
                                    : "#dc2626",
                        }}
                      >
                        {dist}
                        {pct != null && pct > 100 && (
                          <span className="ml-1 text-[10px] text-blue-500">🔵</span>
                        )}
                      </td>,
                    ];
                  })}
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50">
              🔵 Volume Encerrado superior ao Ofertado — lote adicional exercido. CVM = volume registrado (sem lote). ANBIMA = volume efetivamente distribuído (inclui lote adicional).
              {dataBaseCaptacao && (
                <span className="ml-2 font-medium">· Data base: {dataBaseCaptacao}</span>
              )}
            </p>
          </div>
        </>
      )}

      {/* ── TAB: Registradas × Encerradas (CVM) ───────────────────────────── */}
      {tab === "registradas" && (
        <>
          <div className="flex justify-end">
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
              <button
                onClick={() => setMetrica("quantidade")}
                className={`px-3 py-1.5 transition-colors ${
                  metrica === "quantidade"
                    ? "bg-[#0F3443] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Quantidade
              </button>
              <button
                onClick={() => setMetrica("volume")}
                className={`border-l border-gray-200 px-3 py-1.5 transition-colors ${
                  metrica === "volume"
                    ? "bg-[#0F3443] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Volume (R$)
              </button>
            </div>
          </div>

          <p className="-mt-2 text-xs text-gray-500">
            Taxa de encerramento = {metrica === "quantidade" ? "operações encerradas / registradas" : "volume (registrado) das encerradas / total registrado"}.
            Agrupado por <strong>ano de início</strong> da oferta. Inclui ICVM/400, ICVM/476 e RCVM/160. Fonte: CVM.
            {dataBaseCvm && (
              <span className="ml-1 font-medium text-gray-600">· Data base: {dataBaseCvm}</span>
            )}
          </p>

          {/* Gráfico consolidado */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Consolidado — {metrica === "quantidade" ? "Nº de operações" : "Volume (R$ bi)"}
              </h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: PALETTE.amber + "22", color: PALETTE.amber }}
              >
                {fmtPct(consolidadoChart[consolidadoChart.length - 1]?.taxa ?? 0)} encerrado (último ano)
              </span>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              FIDC + FII + FIP + Debêntures (Debêntures apenas a partir de 2023 — Res. 160)
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={consolidadoChart}
                margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ano" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => metrica === "volume" ? `${v}B` : String(v)}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(v: unknown, name: unknown) => [
                    metrica === "volume"
                      ? `R$ ${(v as number).toFixed(1)} bi`
                      : `${(v as number).toLocaleString("pt-BR")} ${yLabel}`,
                    name as string,
                  ]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ofertadas" fill={PALETTE.grayLight} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Ofertadas"
                    position="top"
                    style={{ fontSize: 11, fill: "#6b7280" }}
                    formatter={(v: unknown) =>
                      metrica === "volume" ? `${(v as number).toFixed(1)}` : String(v as number)
                    }
                  />
                </Bar>
                <Bar dataKey="Encerradas" fill={PALETTE.amber} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Encerradas"
                    position="top"
                    style={{ fontSize: 11, fill: PALETTE.amber }}
                    formatter={(v: unknown) =>
                      metrica === "volume" ? `${(v as number).toFixed(1)}` : String(v as number)
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex justify-around border-t border-gray-100 pt-3">
              {consolidadoChart.map((r) => (
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
                  <p className="text-[10px] text-gray-400">taxa encerramento</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mini-gráficos por tipo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chartByTipo.map(({ tipo, rows }) => {
              const color = TIPO_COLORS[tipo] ?? PALETTE.gray;
              const ultimaTaxa = rows[rows.length - 1]?.taxa ?? 0;
              return (
                <div key={tipo} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">{tipo}</h4>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ background: color }}
                    >
                      {fmtPct(ultimaTaxa)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rows} margin={{ top: 18, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ano" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(v: unknown, name: unknown) => [
                          metrica === "volume"
                            ? `R$ ${(v as number).toFixed(1)} bi`
                            : `${(v as number).toLocaleString("pt-BR")} ${yLabel}`,
                          name as string,
                        ]}
                      />
                      <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Ofertadas" fill={PALETTE.grayLight} radius={[2, 2, 0, 0]}>
                        <LabelList
                          dataKey="Ofertadas"
                          position="top"
                          style={{ fontSize: 8, fill: "#9ca3af" }}
                        />
                      </Bar>
                      <Bar dataKey="Encerradas" fill={color} radius={[2, 2, 0, 0]}>
                        <LabelList
                          dataKey="Encerradas"
                          position="top"
                          style={{ fontSize: 8, fill: color }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-around border-t border-gray-50 pt-2">
                    {rows.map((r) => (
                      <div key={r.ano} className="text-center">
                        <p className="text-[9px] text-gray-400">{r.ano}</p>
                        <p
                          className="text-[11px] font-bold"
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
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela resumo */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  {data.anos.flatMap((ano) => [
                    <th key={`${ano}-of`} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {ano} — Ofert.
                    </th>,
                    <th key={`${ano}-enc`} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      Enc. (taxa)
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TIPOS_CVM.map((tipo) => {
                  const color = TIPO_COLORS[tipo] ?? PALETTE.gray;
                  const hasData = data.por_tipo_ano.some((r) => r.tipo_ativo === tipo);
                  if (!hasData) return null;
                  return (
                    <tr key={tipo} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: color }}
                        >
                          {tipo}
                        </span>
                      </td>
                      {data.anos.flatMap((ano) => {
                        const r = data.por_tipo_ano.find(
                          (x) => x.ano === ano && x.tipo_ativo === tipo
                        );
                        const val = r
                          ? metrica === "quantidade"
                            ? fmtBR(r.n_ofertadas)
                            : fmtBi(r.vol_ofertado)
                          : "—";
                        const enc = r
                          ? metrica === "quantidade"
                            ? `${fmtBR(r.n_encerradas)} (${fmtPct(r.taxa_encerramento)})`
                            : `${fmtBi(r.vol_encerrado)} (${fmtPct(r.taxa_encerramento)})`
                          : "—";
                        return [
                          <td key={`${ano}-of`} className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {val}
                          </td>,
                          <td
                            key={`${ano}-enc`}
                            className="px-3 py-2 text-right tabular-nums font-medium"
                            style={{
                              color: r
                                ? r.taxa_encerramento >= 80
                                  ? PALETTE.secondary
                                  : r.taxa_encerramento >= 60
                                    ? PALETTE.amber
                                    : "#dc2626"
                                : "#9ca3af",
                            }}
                          >
                            {enc}
                          </td>,
                        ];
                      })}
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 font-semibold hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">Consolidado</td>
                  {data.anos.flatMap((ano) => {
                    const r = data.consolidado_ano.find((x) => x.ano === ano);
                    const val = r
                      ? metrica === "quantidade"
                        ? fmtBR(r.n_ofertadas)
                        : fmtBi(r.vol_ofertado)
                      : "—";
                    const enc = r
                      ? metrica === "quantidade"
                        ? `${fmtBR(r.n_encerradas)} (${fmtPct(r.taxa_encerramento)})`
                        : `${fmtBi(r.vol_encerrado)} (${fmtPct(r.taxa_encerramento)})`
                      : "—";
                    return [
                      <td key={`${ano}-of`} className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {val}
                      </td>,
                      <td
                        key={`${ano}-enc`}
                        className="px-3 py-2.5 text-right tabular-nums font-bold"
                        style={{
                          color: r
                            ? r.taxa_encerramento >= 80
                              ? PALETTE.secondary
                              : r.taxa_encerramento >= 60
                                ? PALETTE.amber
                                : "#dc2626"
                            : "#9ca3af",
                        }}
                      >
                        {enc}
                      </td>,
                    ];
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
