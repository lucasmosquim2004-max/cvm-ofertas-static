import { Building2, Filter } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { SummaryData } from "@/types/oferta";

interface RankItem {
  name: string;
  volume: number;
  n: number;
}

function RankingCard({
  title,
  icon: Icon,
  data,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: RankItem[];
}) {
  const maxVol = Math.max(...data.map((d) => d.volume), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Icon className="h-4 w-4 text-[#2d6a4f]" />
        {title}
      </h3>
      <ol className="space-y-3">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2.5 text-xs">
            <span className="w-4 shrink-0 text-right font-medium text-gray-400">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate font-medium text-[#1e3a5f]"
                  title={d.name}
                >
                  {d.name}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium tabular-nums text-gray-700">
                    {formatBRL(d.volume)}
                  </span>
                  <span className="w-8 text-right tabular-nums text-gray-400">{d.n}x</span>
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full bg-[#2d6a4f] transition-all"
                  style={{ width: `${(d.volume / maxVol) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Props {
  top_emissores: SummaryData["top_emissores"];
  top_coordenadores: SummaryData["top_coordenadores"];
}

export function RankingsSection({ top_emissores, top_coordenadores }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-[#1e3a5f]">Rankings de Mercado</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingCard
          title="Top Emissores por Volume (12 meses)"
          icon={Building2}
          data={top_emissores.map((d) => ({
            name: d.emissor_nome,
            volume: d.volume,
            n: d.n,
          }))}
        />
        <RankingCard
          title="Top Coordenadores Líderes (12 meses)"
          icon={Filter}
          data={top_coordenadores.map((d) => ({
            name: d.coordenador,
            volume: d.volume,
            n: d.n,
          }))}
        />
      </div>
    </section>
  );
}
