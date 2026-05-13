export interface Oferta {
  codigo_cvm: string | null;
  numero_processo: string | null;
  cnpj_emissor: string | null;
  emissor_nome: string | null;
  tipo_fundo: string | null;
  tipo_ativo: string | null;
  tipo_lastro: string | null;
  rito: string | null;
  modalidade: string | null;
  data_inicio: string | null;
  data_encerramento: string | null;
  status: "Ativa" | "Encerrada" | string;
  volume: number | null;
  coordenador: string | null;
  gestor: string | null;
  publico_alvo: string | null;
  fonte: "legado" | "resolucao_160" | string;
}

export interface SummaryData {
  novas_30d: number;
  volume_30d: number;
  ativas_12m: number;
  total_ano: number;
  por_tipo: { tipo_fundo: string; n: number; volume: number }[];
  por_mes: { mes: string; n: number; volume: number }[];
  por_tipo_60d: { tipo_ativo: string; volume: number; n: number }[];
  por_status_12m: { status_cvm: string; n: number }[];
  top_emissores: { emissor_nome: string; volume: number; n: number }[];
  top_coordenadores: { coordenador: string; volume: number; n: number }[];
}
