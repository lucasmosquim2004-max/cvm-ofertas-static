export interface OverviewRow {
  ano: number;
  tipo_fundo: string;
  n: number;
  volume: number;
  ativas: number;
}

export interface OverviewData {
  rows: OverviewRow[];
  kpis: {
    total_ano: number;
    volume_ano: number;
    ytd_atual_n: number;
    ytd_anterior_n: number;
    ytd_atual_vol: number;
    ytd_anterior_vol: number;
    ytd_yoy_n: number;
    ytd_yoy_vol: number;
    ativas_total: number;
  };
  data_base?: string | null;
}

export interface TendenciaRow {
  mes: string;
  tipo_fundo: string;
  n: number;
  volume: number;
}

export interface TicketRow {
  ano: number;
  tipo_fundo: string;
  ticket_medio: number;
  n: number;
}

export interface TendenciaData {
  anual: OverviewRow[];
  mensal: TendenciaRow[];
  ticket: TicketRow[];
}

export interface EficienciaRow {
  tipo_fundo: string;
  rito: string;
  ano: number;
  total: number;
  encerradas: number;
  dias_medio_captacao: number | null;
}

export interface EficienciaData {
  dias: EficienciaRow[];
  ticket_atual: { tipo_fundo: string; ticket_medio: number; n: number }[];
}

export interface RankingByYear {
  nome: string;
  por_ano: Record<number, number>;
  total: number;
}

export interface SegmentacaoData {
  publico_alvo: { ano: number; publico_alvo: string; n: number }[];
  coordenadores_3y: { ano: number; coordenador: string; volume: number }[];
  gestores_3y: { ano: number; gestor: string; n: number }[];
  lastro: { tipo_lastro: string; n: number }[];
  anos: number[];
}

export interface PipelineData {
  sazonalidade: { mes_num: number; media_por_ano: number }[];
  ano_min?: number | null;
  ano_max?: number | null;
}

export interface VolumeMensalRow {
  mes: string;
  valor_mobiliario: string;
  volume: number;
  n: number;
}

export interface VolumeMensalData {
  rows: VolumeMensalRow[];
}

export interface CaptacaoPorClasseRow {
  tipo_fundo: string;
  n_ofertas: number;
  n_encerradas: number;
  n_ativas: number;
  n_com_anbima: number;
  total_ofertado: number;
  total_captado: number;
  taxa_media: number;
  taxa_mediana: number;
}

export interface CaptacaoMensalRow {
  mes: string;
  tipo_fundo: string;
  ofertado: number;
  captado: number;
}

export interface CaptacaoTopRow {
  numero_processo: string;
  emissor_nome: string;
  tipo_fundo: string;
  data_encerramento: string;
  valor_ofertado: number;
  delta_pl: number;
  taxa_captacao: number;
}

export interface SecuritizacaoTipoAnoRow {
  ano: number;
  tipo_ativo: string;
  n_ofertadas: number;
  n_encerradas: number;
  vol_ofertado: number;
  vol_encerrado: number;
  taxa_encerramento: number;
  vol_distribuido_anbima: number | null;
  n_distribuidas_anbima: number | null;
}

export interface SecuritizacaoConsolidadoRow {
  ano: number;
  n_ofertadas: number;
  n_encerradas: number;
  vol_ofertado: number;
  vol_encerrado: number;
  taxa_encerramento: number;
  vol_distribuido_anbima: number | null;
  n_distribuidas_anbima: number | null;
}

export interface CaptacaoEfetivaTipoRow {
  ano: number;
  tipo_ativo: string;
  vol_ofertado_cvm: number;
  n_encerradas_cvm: number;
  vol_encerrado_anbima: number | null;
  n_encerradas_anbima: number | null;
}

export interface CaptacaoEfetivaConsolidadoRow {
  ano: number;
  vol_ofertado_cvm: number;
  n_encerradas_cvm: number;
  vol_encerrado_anbima: number | null;
  n_encerradas_anbima: number | null;
}

export interface SecuritizacaoData {
  disponivel: boolean;
  anbima_disponivel: boolean;
  anbima_data_base?: string | null;
  cvm_data_base?: string | null;
  anos: number[];
  anos_captacao?: number[];
  por_tipo_ano: SecuritizacaoTipoAnoRow[];
  consolidado_ano: SecuritizacaoConsolidadoRow[];
  captacao_tipo_ano?: CaptacaoEfetivaTipoRow[];
  captacao_consolidado?: CaptacaoEfetivaConsolidadoRow[];
}

export interface TaxaSucessoAnoRow {
  ano: number;
  tipo_fundo: string; // 'Cotas de FIDC' | 'Cotas de FIP' | 'Cotas de FII' | 'Consolidado'
  n_ofertadas: number;
  n_encerradas: number;
  taxa_sucesso: number; // percentual: n_encerradas / n_ofertadas * 100
}

export interface CaptacaoRealData {
  disponivel: boolean;
  total_cvm: number;
  total_processadas: number;
  cobertura_anbima: number;
  status_breakdown: { fetch_status: string; n: number }[];
  taxa_sucesso: TaxaSucessoAnoRow[];
  por_classe: CaptacaoPorClasseRow[];
  mensal: CaptacaoMensalRow[];
  top_sub: CaptacaoTopRow[];
}
