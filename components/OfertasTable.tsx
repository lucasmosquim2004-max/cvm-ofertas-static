"use client";

import { useState, useMemo } from "react";
import { formatBRL, formatDate } from "@/lib/utils";
import type { Oferta } from "@/types/oferta";
import { Search } from "lucide-react";

const TIPOS = ["FIDC", "FIDC NP", "FII", "FIP", "FICFIDC", "FICFIP"];
const RITOS = ["Automático", "Ordinário", "ICVM 400", "ICVM 476"];
const PUBLICOS = ["Profissional", "Qualificado", "Geral"];
const PAGE_SIZE = 20;

const TIPO_COLORS: Record<string, string> = {
  FIDC: "bg-blue-100 text-blue-800",
  "FIDC NP": "bg-blue-600 text-white",
  FII: "bg-green-100 text-green-800",
  FIP: "bg-purple-100 text-purple-800",
  FICFIDC: "bg-slate-100 text-slate-700",
  FICFIP: "bg-slate-50 text-slate-600",
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-gray-400">—</span>;
  const cls = TIPO_COLORS[tipo] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {tipo}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${status === "Ativa" ? "bg-green-500" : "bg-gray-300"}`}
      />
      <span className="text-xs text-gray-600">{status}</span>
    </span>
  );
}

interface Props {
  data: Oferta[];
}

export function OfertasTable({ data }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [rito, setRito] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [dataFrom, setDataFrom] = useState("");
  const [dataTo, setDataTo] = useState("");
  const [volMin, setVolMin] = useState("");
  const [volMax, setVolMax] = useState("");
  const [page, setPage] = useState(1);

  function applySearch() {
    setQ(searchInput);
    setPage(1);
  }

  const filtered = useMemo(() => {
    let rows = data;

    if (q) {
      const lower = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.emissor_nome?.toLowerCase().includes(lower) ?? false) ||
          (r.cnpj_emissor?.toLowerCase().includes(lower) ?? false)
      );
    }
    if (tipo) rows = rows.filter((r) => r.tipo_fundo === tipo);
    if (status) rows = rows.filter((r) => r.status === status);
    if (rito) rows = rows.filter((r) => r.rito === rito);
    if (publicoAlvo) rows = rows.filter((r) => r.publico_alvo === publicoAlvo);
    if (dataFrom) rows = rows.filter((r) => r.data_inicio != null && r.data_inicio >= dataFrom);
    if (dataTo) rows = rows.filter((r) => r.data_inicio != null && r.data_inicio <= dataTo);
    if (volMin) rows = rows.filter((r) => r.volume != null && r.volume >= Number(volMin));
    if (volMax) rows = rows.filter((r) => r.volume != null && r.volume <= Number(volMax));

    return rows;
  }, [data, q, tipo, status, rito, publicoAlvo, dataFrom, dataTo, volMin, volMax]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectCls =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30";

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Barra de busca principal */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <div className="relative flex min-w-[220px] flex-1 items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por emissor ou CNPJ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
          />
        </div>
        <button
          onClick={applySearch}
          className="rounded-lg bg-[#2d6a4f] px-4 py-2 text-sm font-medium text-white hover:bg-[#245a41] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/40"
        >
          Buscar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Filtros</span>

        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Status</option>
          <option value="Ativa">Ativa</option>
          <option value="Encerrada">Encerrada</option>
        </select>

        <select value={tipo} onChange={(e) => { setTipo(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Tipo de Ativo</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={rito} onChange={(e) => { setRito(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Tipo de Oferta</option>
          {RITOS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={publicoAlvo} onChange={(e) => { setPublicoAlvo(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Público-Alvo</option>
          {PUBLICOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dataFrom}
            onChange={(e) => { setDataFrom(e.target.value); resetPage(); }}
            className={`${selectCls} w-36`}
            title="Data início (de)"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={dataTo}
            onChange={(e) => { setDataTo(e.target.value); resetPage(); }}
            className={`${selectCls} w-36`}
            title="Data início (até)"
          />
        </div>

        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="R$ mín"
            value={volMin}
            onChange={(e) => { setVolMin(e.target.value); resetPage(); }}
            className={`${selectCls} w-24`}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="number"
            placeholder="R$ máx"
            value={volMax}
            onChange={(e) => { setVolMax(e.target.value); resetPage(); }}
            className={`${selectCls} w-24`}
          />
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length.toLocaleString("pt-BR")} ofertas
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">Data Req.</th>
              <th className="px-4 py-3 font-medium">Emissor</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium text-right">Volume</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Gestor</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Coordenador</th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">Público</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">Encerramento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma oferta encontrada.
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {formatDate(r.data_inicio)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="block max-w-[220px] truncate font-medium text-[#1e3a5f]"
                      title={r.emissor_nome ?? ""}
                    >
                      {r.emissor_nome ?? "—"}
                    </span>
                    {r.cnpj_emissor && (
                      <span className="text-xs text-gray-400">{r.cnpj_emissor}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TipoBadge tipo={r.tipo_fundo} />
                    {r.tipo_lastro && (
                      <span className="mt-1 block text-[10px] text-gray-400">
                        {r.tipo_lastro}
                      </span>
                    )}
                    {r.tipo_ativo && r.tipo_ativo !== r.tipo_fundo && (
                      <span
                        className="mt-0.5 block max-w-[140px] truncate font-mono text-[9px] text-gray-300"
                        title={r.tipo_ativo}
                      >
                        {r.tipo_ativo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatBRL(r.volume)}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                    <span className="block max-w-[180px] truncate" title={r.gestor ?? ""}>
                      {r.gestor ?? "—"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">
                    <span className="block max-w-[180px] truncate" title={r.coordenador ?? ""}>
                      {r.coordenador ?? "—"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 xl:table-cell">
                    {r.publico_alvo ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={r.status} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-gray-500 xl:table-cell">
                    {formatDate(r.data_encerramento)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <span className="text-xs text-gray-400">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
