export const BALANCING_SCHEMA = {
  fii: ['Renda Imobiliária', 'Crédito Imobiliário', 'Desenvolvimento Imobiliário', 'Outros'],
  acoes: ['Financeiro Brasileiro', 'Consumo Essencial', 'Indústria Global', 'Outros'],
  etf: ['Ações Globais', 'Juros Pós-fixados', 'Juros Reais', 'Mercado Imobiliário', 'Outros'],
  outros: ['Indefinido'],
};

export const LEGACY_SUBTYPE_MAP = {
  Tijolo: 'Renda Imobiliária',
  Papel: 'Crédito Imobiliário',
  Híbrido: 'Outros',
  Desenvolvimento: 'Desenvolvimento Imobiliário',
  'Fundos de Fundos': 'Outros',
  'Perenes (Renda/Defesa)': 'Outros',
  'Cíclicas (Valor/Crescimento)': 'Outros',
  'Base Global': 'Ações Globais',
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

export async function classifyAsset(ticker) {
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
