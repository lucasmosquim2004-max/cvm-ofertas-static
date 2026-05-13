"use client";

import { HorizontalBarChart, type BarDataPoint } from "@/components/HorizontalBarChart";
import { formatBRL } from "@/lib/utils";

interface Props {
  porTipo: BarDataPoint[];
  porStatus: BarDataPoint[];
}

export function ChartsSection({ porTipo, porStatus }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <HorizontalBarChart
        title="Volume por Tipo de Ativo (60d)"
        subtitle="Todas as classes — CRI, CRA, Debêntures, FIDC, FII e outras"
        data={porTipo}
        valueFormatter={(v) => formatBRL(v) ?? "—"}
      />
      <HorizontalBarChart
        title="Status das Ofertas (12 meses)"
        subtitle="Distribuição por situação do requerimento"
        data={porStatus}
        valueFormatter={(v) => v.toLocaleString("pt-BR")}
      />
    </div>
  );
}
