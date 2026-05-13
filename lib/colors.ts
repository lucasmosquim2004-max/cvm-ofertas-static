export const PALETTE = {
  primary: "#0F3443",
  primaryMid: "#1E5266",
  primaryLight: "#5C90A3",
  secondary: "#3F7957",
  secondaryMid: "#5A9A75",
  secondaryLight: "#88B59B",
  gray: "#8A8785",
  grayDark: "#5F5D5C",
  grayLight: "#B6B7B7",
  amber: "#B6783D",
  amberLight: "#D6A06B",
} as const;

// Mapeamento por classificação (estilo Valor_Mobiliario CVM)
export const FUND_COLORS: Record<string, string> = {
  "Cotas de FIDC": PALETTE.primary,
  "Cotas de FII": PALETTE.secondary,
  "Cotas de FIP": PALETTE.gray,
  // Fallbacks legacy (caso ainda apareçam)
  FIDC: PALETTE.primary,
  FII: PALETTE.secondary,
  FIP: PALETTE.gray,
  "FIDC NP": PALETTE.primaryMid,
  FICFIDC: PALETTE.primaryLight,
  FICFIP: PALETTE.grayDark,
};

export const FUND_COLOR_DEFAULT = PALETTE.grayDark;

export function fundColor(tipo: string): string {
  return FUND_COLORS[tipo] ?? FUND_COLOR_DEFAULT;
}

export const PUBLICO_COLORS: Record<string, string> = {
  Geral: PALETTE.primary,
  Qualificado: PALETTE.secondary,
  Profissional: PALETTE.gray,
};

export const PUBLICO_COLOR_DEFAULT = PALETTE.grayLight;

export function publicoColor(p: string): string {
  return PUBLICO_COLORS[p] ?? PUBLICO_COLOR_DEFAULT;
}

// Comparação de 3 anos com cores bem distintas (não escala)
export const YEAR_COMPARE_COLORS = [
  PALETTE.amber, // ano-2 (mais antigo)
  PALETTE.secondary, // ano-1
  PALETTE.primary, // ano atual
];

// Mapeamento de cor por Valor_Mobiliario da CVM
// Cada família tem hue distinto para máxima legibilidade do empilhado.
export const VALOR_MOBILIARIO_COLORS: Record<string, string> = {
  // Fundos principais — hues bem separados
  "Cotas de FIDC": "#0F3443", // teal escuro (anchor)
  "Cotas de FII": "#3F7957", // verde floresta (anchor)
  "Cotas de FIP": "#7C3AED", // roxo
  "Cotas de FIF": "#EAB308", // dourado
  "Cotas de Fundos de Infra": "#06B6D4", // ciano

  // FIAGRO e variantes — laranja/lime (família agro)
  "Cotas de FIAGRO": "#F97316", // laranja vivo
  "Cotas de FIAGRO - FIDC": "#0EA5E9", // azul claro
  "Cotas de FIAGRO - FII": "#84CC16", // lime
  "Cotas de FIAGRO - FIP": "#A78BFA", // lilás

  // Dívida — vermelho/rosa
  Debêntures: "#DC2626", // vermelho
  "Notas Comerciais": "#F472B6", // rosa

  // Securitização — cinzas/slate + amarelos terra
  "Certificados de Recebíveis Imobiliários": "#475569", // slate escuro
  "Certificados de Recebíveis do Agronegócio": "#B6783D", // âmbar
  "Certificados de Recebíveis": "#94A3B8", // slate claro
  "Certificado de Direitos Creditórios do Agronegócio": "#B45309", // ocre
  "Outros títulos de securitização": "#6B7280", // cinza médio
  "Cédula de Produto Rural Financeira": "#65A30D", // verde oliva

  Outros: "#B6B7B7",
};

const FALLBACK_PALETTE = [
  "#0F3443",
  "#3F7957",
  "#7C3AED",
  "#EAB308",
  "#F97316",
  "#06B6D4",
  "#DC2626",
  "#475569",
  "#84CC16",
  "#F472B6",
];

export function mobiliarioColor(name: string, fallbackIndex = 0): string {
  return (
    VALOR_MOBILIARIO_COLORS[name] ??
    FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]
  );
}
