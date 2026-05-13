"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "volume-mensal", label: "Volume Mensal" },
  { id: "historico-volume", label: "Histórico de Volume" },
  { id: "metricas-captacao", label: "Métricas de Captação" },
{ id: "mercado-capitais", label: "Mercado de Capitais" },
  { id: "segmentacao", label: "Segmentação" },
  { id: "sazonalidade", label: "Sazonalidade" },
];

export function MercadoSidebar() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const map = new Map<string, number>();

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          map.set(id, entry.intersectionRatio);
          const best = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
          if (best && best[1] > 0) setActive(best[0]);
        },
        { threshold: [0, 0.1, 0.25, 0.5], rootMargin: "-80px 0px -40% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <nav className="hidden lg:block fixed left-0 top-[57px] h-[calc(100vh-57px)] w-48 overflow-y-auto border-r border-gray-100 bg-white px-2 py-4 z-10">
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Navegação
      </p>
      <ul className="space-y-0.5">
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <button
              onClick={() => scrollTo(id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                active === id
                  ? "bg-[#0F3443] font-medium text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
