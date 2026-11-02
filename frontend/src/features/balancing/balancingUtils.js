export const BALANCING_SCHEMA = {
  fii: ['Tijolo', 'Papel', 'Desenvolvimento', 'Outros'],
  acoes: ['Bancos e Seguradoras', 'Alimentos', 'Indústria', 'Outros'],
  etf: ['Ações Internacionais', 'Baixa Volatilidade', 'Inflação', 'Imobiliários', 'Outros'],
  outros: ['Indefinido'],
};

export const LEGACY_SUBTYPE_MAP = {
  Desenvolvimento: 'Desenvolvimento',
  Híbrido: 'Outros',
  'Fundos de Fundos': 'Outros',
  Multiestratégia: 'Outros',
  'Pós-fixados': 'Baixa Volatilidade',
  'Renda Fixa': 'Baixa Volatilidade',
  'Perenes (Renda/Defesa)': 'Outros',
  'Cíclicas (Valor/Crescimento)': 'Outros',
  'Base Global': 'Ações Internacionais',
  'Base Brasil': 'Outros',
  'Específicos/Fatores': 'Outros',
  Cripto: 'Outros',
};

export function normalizeBalancingTargets(targets) {
  const source = targets || {};
  const macro = { fii: 0, acoes: 0, etf: 0, outros: 0, ...(source.macro || {}) };
  const micro = {};

  Object.entries(BALANCING_SCHEMA).forEach(([macroKey, categories]) => {
    const values = source.micro?.[macroKey] || {};
    micro[macroKey] = Object.fromEntries(categories.map((category) => [category, 0]));
    Object.entries(values).forEach(([category, value]) => {
      const normalized = categories.includes(category)
        ? category
        : LEGACY_SUBTYPE_MAP[category] || 'Outros';
      if (normalized in micro[macroKey]) micro[macroKey][normalized] += Number(value) || 0;
    });
  });

  return { macro, micro };
}


// Classificações conhecidas para o balanceamento.
// Novos tickers continuam usando o classificador do backend.
const LOCAL_CLASSIFICATIONS = Object.freeze({
  BTLG11: ['FII - Tijolo (Logística)', 'Tijolo'],
  XPCM11: ['FII - Tijolo (Renda)', 'Tijolo'],
  KFOF11: ['FII - Tijolo (Fundo de Fundos)', 'Tijolo'],
  KNCR11: ['FII - Papel (CRI)', 'Papel'],
  VGIR11: ['FII - Papel (CDI)', 'Papel'],
  KNHF11: ['FII - Papel (CRI)', 'Papel'],
  TGAR11: ['FII - Desenvolvimento', 'Desenvolvimento'],

  XFIX11: ['ETF - Imobiliários', 'Imobiliários'],
  WRLD11: ['ETF - Internacional (Global)', 'Ações Internacionais'],
  IVVB11: ['ETF - Internacional (S&P 500)', 'Ações Internacionais'],
  QQQQ11: ['ETF - Tech (Nasdaq)', 'Ações Internacionais'],
  IMAB11: ['ETF - Juros Reais', 'Inflação'],
  LFTB11: ['ETF - Baixa Volatilidade', 'Baixa Volatilidade'],
  AUPO11: ['ETF - Baixa Volatilidade', 'Baixa Volatilidade'],

  WEGE3: ['Ação - Indústria Global', 'Indústria'],
  BBAS3: ['Ação - Financeiro Brasileiro', 'Bancos e Seguradoras'],
  BBSE3: ['Ação - Financeiro Brasileiro', 'Bancos e Seguradoras'],
  MDIA3: ['Ação - Consumo Essencial', 'Alimentos'],
});

export async function classifyAsset(ticker) {
  const normalizedTicker = String(ticker).trim().toUpperCase().replace(/\.SA$/, '');
  const local = LOCAL_CLASSIFICATIONS[normalizedTicker];

  if (local) {
    return {
      ticker: normalizedTicker,
      detected_type: local[0],
      sector: local[1],
      confidence: 100,
      source: 'local',
      reasoning: 'Classificação definida localmente para balanceamento.',
    };
  }

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  try {
    const response = await fetch(`${API_URL}/sync/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });

    if (!response.ok) throw new Error('Falha na requisição');

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erro ao classificar ${ticker}:`, error);
    return {
      ticker,
      detected_type: 'Indefinido',
      reasoning: 'Erro de conexão ou ativo não encontrado',
    };
  }
}
