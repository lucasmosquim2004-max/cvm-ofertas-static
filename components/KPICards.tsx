"use client";

import { formatBRL } from "@/lib/utils";
import type { SummaryData } from "@/types/oferta";

interface Props {
  summary: SummaryData;
}

function KPICard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[#1e3a5f]">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function KPICards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KPICard
        label="Novas Ofertas (30 dias)"
        value={summary.novas_30d.toLocaleString("pt-BR")}
        sub="FIDCs, FIIs e FIPs"
      />
      <KPICard
        label="Volume (30 dias)"
        value={formatBRL(summary.volume_30d)}
        sub="soma de todas as novas"
      />
      <KPICard
        label="Ofertas Ativas (12 meses)"
        value={summary.ativas_12m.toLocaleString("pt-BR")}
        sub="em distribuição"
      />
      <KPICard
        label="Total no Ano"
        value={summary.total_ano.toLocaleString("pt-BR")}
        sub={String(new Date().getFullYear())}
      />
    </div>
  );
}
