import {
  NAV,
  DISTRIBUTIONS,
  TGAR_LIQUIDITY,
  TGAR_ECONOMIC_RATIO,
} from './TgarPurchasePanel.jsx';

// Catálogo de relatórios pesquisados manualmente. Não preencher lacunas com zero.
// month = competência (YYYY-MM); publishedAt = data de divulgação do documento.
// Campos de fonte ausentes significam que a auditoria por competência está pendente.
const yearMonth = (month) => {
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [name, year] = month.split('/');
  return `20${year}-${String(names.indexOf(name) + 1).padStart(2, '0')}`;
};
const points = (series) => series.map((row) => ({ ...row, month: yearMonth(row.month) }));

export const FII_HEALTH_REPORTS = {
  TGAR11: {
    ticker: 'TGAR11', name: 'TG Ativo Real',
    startMonth: '2024-12', endMonth: '2026-10',
    pvpNav: 107.50,
    summary: 'A evolução dos indicadores está separada das datas dos aportes.',
    charts: [
      { id: 'nav', title: 'Valor patrimonial por cota', unit: 'brl_per_share', color: '#f43f5e',
        data: points(NAV),
        note: 'Valores patrimoniais dos informes mensais. Eixo vertical ampliado.' },
      { id: 'distributions', title: 'Rendimentos anunciados por cota', unit: 'brl_per_share', color: '#f59e0b',
        data: points(DISTRIBUTIONS),
        note: 'Competência do anúncio; o anúncio pode ocorrer depois do fechamento do mês.' },
      { id: 'economicRatio', title: 'Ganho patrimonial acumulado ÷ proventos', unit: 'percent', color: '#f43f5e',
        reference: 100, data: points(TGAR_ECONOMIC_RATIO),
        note: 'Proxy: (variação do VP desde dez/24 + proventos acumulados) ÷ proventos. Não mede geração de caixa.' },
      { id: 'liquidity', title: 'Liquidez imediata ÷ rendimentos a distribuir', unit: 'percent', color: '#f59e0b',
        reference: 100, data: points(TGAR_LIQUIDITY),
        note: 'Campos 9 ÷ 12 dos informes B3/CVM. Referência de 100% não é um teste de solvência.' },
    ],
    facts: [
      { label: 'Patrimônio por cota (dez/24–nov/25)', value: '−6,6%', detail: '11 quedas mensais consecutivas antes do aporte.', severity: 'danger' },
      { label: 'Reserva acumulada (out/25)', value: 'R$ 0,18/cota', detail: '18% da distribuição mensal.', severity: 'warning' },
      { label: 'Receita de equity (out/25)', value: '76,06%', detail: 'Participação na receita do mês, não no patrimônio.', severity: 'warning' },
      { label: 'Variação patrimonial (jan–out/25)', value: '−R$ 160,26 mi', detail: 'Não equivale a perda de caixa.', severity: 'danger' },
      { label: 'Cobertura de caixa (1S25)', value: '99,5%', detail: 'R$ 140,69 mi gerados ÷ R$ 141,41 mi distribuídos.', severity: 'warning' },
      { label: 'Liquidez (nov/25)', value: 'R$ 9,08 mi', detail: 'Rendimentos a distribuir: R$ 23,6 mi.', severity: 'warning' },
      { label: 'Alavancagem (nov/25)', value: '0,20%', detail: 'Conforme informe mensal.' },
    ],
    sources: [
      { label: 'Gerencial out/25 · p. 12', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1059871#page=12' },
      { label: 'Informe nov/25', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1068335' },
      { label: 'Informe set/26', url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1352690' },
      { label: 'Histórico de rendimentos', url: 'https://tgar11.com.br/relatorio/rendimentos/' },
    ],
  },
  XPCM11: {
    ticker: 'XPCM11', name: 'XP Corporate Macaé',
    startMonth: '2024-12', endMonth: '2026-10',
    summary: 'VP/cota e proventos: dez/24–set/26. Vacância e resultado: competências confirmadas em PDFs oficiais, com lacunas preservadas. O ajuste patrimonial de dez/25 e a emissão de cotas de ago/26 afetam a leitura do VP/cota.',
    charts: [
      {
        id: 'nav', title: 'Valor patrimonial por cota',
        unit: 'brl_per_share', color: '#f43f5e',
        data: [
          ['2024-12', 27.22, '2025-01-15'],
          ['2025-01', 27.18, '2025-02-14'],
          ['2025-02', 27.06, '2025-03-14'],
          ['2025-03', 26.90, '2025-04-28'],
          ['2025-04', 26.76, '2025-05-26'],
          ['2025-05', 26.58, '2025-06-13'],
          ['2025-06', 26.26, '2025-07-15'],
          ['2025-07', 28.87, '2025-08-14'],
          ['2025-08', 28.81, '2025-09-12'],
          ['2025-09', 28.92, '2025-10-10'],
          ['2025-10', 28.86, '2025-11-07'],
          ['2025-11', 28.76, '2025-12-08'],
          ['2025-12', 20.54, '2026-04-01'],
          ['2026-01', 20.37, '2026-02-23'],
          ['2026-02', 20.31, '2026-03-10'],
          ['2026-03', 20.38, '2026-04-09'],
          ['2026-04', 20.23, '2026-05-12'],
          ['2026-05', 20.21, '2026-06-11'],
          ['2026-06', 20.22, '2026-07-15'],
          ['2026-07', 20.21, '2026-08-11'],
          ['2026-08', 15.99, '2026-09-11'],
          ['2026-09', 15.98, '2026-10-08'],
        ].map(([month, value, publishedAt]) => ({
          month,
          value,
          publishedAt,
          source:
            'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_'
            + month.slice(0, 4) + '.zip',
          ...(month === '2025-12'
            ? { note: 'Reavaliação negativa do imóvel em 2025.' }
            : {}),
          ...(month === '2026-08'
            ? { note: 'Emissão de 1.264.223 novas cotas em ago/26.' }
            : {}),
        })),
        note: 'Informe mensal CVM (VP contábil, não cotação). Dez/25: ajuste de avaliação do imóvel; ago/26: 2ª emissão de cotas. Valores não são retorno total.',
      },
      {
        id: 'dividends',
        title: 'Rendimentos distribuídos por cota',
        unit: 'brl_per_share',
        color: '#f59e0b',
        data: '2024-12 2025-01 2025-02 2025-03 2025-04 2025-05 2025-06 2025-07 2025-08 2025-09 2025-10 2025-11 2025-12 2026-01 2026-02 2026-03 2026-04 2026-05 2026-06 2026-07 2026-08 2026-09'
          .split(' ')
          .map((month) => ({
            month,
            value: 0,
            source: 'https://www.clubefii.com.br/fiis/XPCM11',
            note: 'Sem distribuição de proventos; relatórios e avisos oficiais do fundo.',
          })),
        note: 'R$ 0,00 em todas as competências de dez/24 a set/26: a ausência de pagamento é dado confirmado, não lacuna preenchida.',
      },
      {
        id: 'vacancy',
        title: 'Vacância física',
        unit: 'percent',
        color: '#f43f5e',
        data: [
          ['2024-12', 62, 824192],
          ['2025-02', 58, 864361, '2025-03-25'],
          ['2025-03', 58, 884213, '2025-04-24'],
          ['2025-04', 58, 912381, '2025-05-28'],
          ['2025-05', 58, 930833, '2025-06-24'],
          ['2025-06', 57, 952560, '2025-07-25'],
          ['2025-07', 57, 978815, '2025-08-27'],
          ['2026-01', 52.3, 1119006, '2026-02-20'],
          ['2026-02', 52.3, 1133831, '2026-03-12'],
          ['2026-03', 48.6, 1159161, '2026-04-10'],
          ['2026-09', 48.6, 1360374, '2026-10-28'],
        ].map(([month, value, id, publishedAt]) => ({
          month,
          value,
          publishedAt,
          source:
            'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id='
            + id,
          page: Number(id) > 1000000 ? 2 : 1,
          ...(month === '2026-09'
            ? {
                note: 'Texto do relatório indica 48,6%; há divergência com o infográfico de ocupação.',
              }
            : {}),
        })),
        note: 'Vacância física informada nos gerenciais do The Corporate. Valores pós-fechamento não foram antecipados; lacunas sem interpolação.',
      },
      {
        id: 'result',
        title: 'Resultado mensal',
        unit: 'brl',
        color: '#f43f5e',
        data: [
          ['2024-12', -24642, 824192],
          ['2025-01', -9460, 847244, '2025-02-24'],
          ['2025-02', -90473, 864361, '2025-03-25'],
          ['2025-03', -227490, 884213, '2025-04-24'],
          ['2025-04', -208900, 912381, '2025-05-28'],
          ['2025-05', -206509, 930833, '2025-06-24'],
          ['2025-06', -190293, 952560, '2025-07-25'],
          ['2025-07', -291836, 978815, '2025-08-27'],
          ['2026-01', -402000, 1119006, '2026-02-20'],
          ['2026-02', 73000, 1133831, '2026-03-12'],
          ['2026-03', 167000, 1159161, '2026-04-10'],
          ['2026-08', 18000, 1360374, '2026-10-28'],
          ['2026-09', -39000, 1360374, '2026-10-28'],
        ].map(([month, value, id, publishedAt]) => ({
          month,
          value,
          publishedAt,
          source:
            'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id='
            + id,
          page: Number(id) > 1000000 ? 7 : 1,
          ...(month >= '2026-01'
            ? {
                note: 'Valor publicado em R$ mil; representado em reais com arredondamento.',
              }
            : {}),
        })),
        note: 'Até jul/25: resultado financeiro em caixa (XP). Em 2026: resultado líquido gerencial (URCA, em R$ mil). Mudou o critério; não comparar como série homogênea.',
      },
    ],
    facts: [
      {
        label: 'VP/cota (dez/24 → set/26)',
        value: '−41,3%',
        detail: 'Inclui reavaliação negativa em 2025 e diluição na 2ª emissão em 2026; não é retorno do cotista.',
        severity: 'danger',
      },
      {
        label: 'Vacância física (dez/24 → set/26)',
        value: '62% → 48,6%',
        detail: 'Redução de 13,4 pontos percentuais; imóvel ainda com vacância elevada.',
        severity: 'warning',
      },
      {
        label: 'Proventos (dez/24–set/26)',
        value: 'R$ 0,00/cota',
        detail: 'Sem distribuições no período.',
        severity: 'danger',
      },
      {
        label: '2ª emissão (ago/26)',
        value: '1.264.223 cotas',
        detail: 'Captação de R$ 10 milhões a R$ 7,91/cota.',
      },
      {
        label: 'Imóveis próprios',
        value: '1',
        detail: 'Edifício The Corporate, Macaé/RJ (monoativo).',
      },
    ],
    sources: [
      {
        label: 'Informes mensais da CVM',
        url: 'https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal',
      },
      {
        label: 'Gerencial jul/25',
        url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=978815',
      },
      {
        label: 'Gerencial mar/26',
        url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1159161',
      },
      {
        label: 'Gerencial set/26',
        url: 'https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=1360374',
      },
    ],
  },
};
