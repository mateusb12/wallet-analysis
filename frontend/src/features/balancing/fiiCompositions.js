// Composições baseadas nos relatórios gerenciais de setembro/2026.
// Valores representam exposições divulgadas pelas gestoras.
// Não são utilizados no cálculo de balanceamento da carteira.

export const FII_COMPOSITIONS = {
  KFOF11: {
    referenceDate: 'Set/2026',
    source: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1339148',
    segments: [
      {
        label: 'Tijolo',
        percent: 52.5,
        color: '#3b82f6',
      },
      {
        label: 'Papel (CRIs)',
        percent: 28.1,
        color: '#f59e0b',
      },
      {
        label: 'FIIs de estratégias mistas',
        percent: 6.8,
        color: '#8b5cf6',
      },
      {
        label: 'Caixa e LCI',
        percent: 12.6,
        color: '#94a3b8',
      },
    ],
    note: 'Composição consolidada por estratégia. Tijolo reúne logística, escritórios, shoppings, renda urbana e residencial.',
  },

  KNHF11: {
    referenceDate: 'Set/2026',
    source: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1353831',
    segments: [
      {
        label: 'Papel (CRIs)',
        percent: 56.8,
        color: '#f59e0b',
      },
      {
        label: 'Tijolo (Imóveis)',
        percent: 30.3,
        color: '#3b82f6',
      },
      {
        label: 'Cotas de FIIs',
        percent: 11.8,
        color: '#8b5cf6',
      },
      {
        label: 'Ações',
        percent: 1.1,
        color: '#10b981',
      },
      {
        label: 'Caixa',
        percent: 6.8,
        color: '#94a3b8',
      },
    ],
    note: 'Exposições sobre o patrimônio do fundo. A soma supera 100% devido à estrutura das posições e obrigações do fundo.',
  },
};
