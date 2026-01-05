export const diagnoseChartIssues = (
  targetPositions,
  assetsHistoryMap,
  benchmarkName,
  earliestPurchaseDate
) => {
  const issues = [];

  // 1. Verificação básica de ativos
  if (!targetPositions || targetPositions.length === 0) {
    return ['⚠️ Nenhum ativo selecionado ou carteira vazia.'];
  }

  // 2. Data de compra (Crucial para o eixo X do gráfico)
  if (!earliestPurchaseDate) {
    issues.push(
      '🔴 Data da primeira compra não identificada (verifique se as transações possuem data válida).'
    );
  }

  // 3. Verificar Benchmark (Crítico para cálculos relativos)
  // O gráfico precisa do CDI/IBOV para traçar a linha comparativa.
  const benchmarkHistory = assetsHistoryMap?.[benchmarkName];
  if (!benchmarkHistory || benchmarkHistory.length === 0) {
    issues.push(`🔴 Benchmark Crítico: Histórico do "${benchmarkName}" vazio no banco de dados.`);
    issues.push(
      'ℹ️ Dica: Verifique se a tabela de dados de mercado (market_data) possui dados para este índice.'
    );
  }

  // Definição do Modo de Visão
  const isTotalView = targetPositions.length > 1;

  // 4. Análise Específica baseada na Visão

  if (isTotalView) {
    // --- VISÃO GERAL (CARTEIRA TOTAL) ---
    // Na visão total, não analisamos 'assetsHistoryMap' para cada ação individualmente,
    // pois o gráfico usa o endpoint '/performance/history' (consolidado).
    // Se esta função foi chamada, significa que o gráfico falhou em renderizar.

    issues.push('🛑 Falha de Carregamento: O endpoint de histórico consolidado retornou vazio.');
    issues.push(
      '⚠️ Possíveis causas: O backend não recebeu o "user_id" corretamente OU não há transações processadas para este usuário.'
    );
  } else {
    // --- VISÃO DE ATIVO ÚNICO ---
    // Aqui sim verificamos o histórico individual do ativo selecionado.
    const pos = targetPositions[0];
    const ticker = pos.ticker;
    const history = assetsHistoryMap?.[ticker];

    if (!history || history.length === 0) {
      issues.push(`🔴 ${ticker}: Histórico individual não encontrado (API retornou array vazio).`);
    } else {
      // Se tem histórico, verificamos a qualidade dos dados (Preços Zerados)
      const badDataSamples = checkDataQuality(history, ticker);
      issues.push(...badDataSamples);
    }
  }

  return issues;
};

// --- Funções Auxiliares ---

const fmtDate = (dateStr) => {
  if (!dateStr) return '??/??/????';
  try {
    const d = new Date(dateStr);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
};

const probePrice = (item) => {
  const candidates = [
    'close',
    'adjusted_close',
    'price',
    'value',
    'valor',
    'cotação',
    'asset_price_raw',
  ];
  for (const key of candidates) {
    if (item[key] !== undefined && item[key] !== null) {
      const parsed = parseFloat(item[key]);
      return { keyFound: key, value: item[key], parsed: isNaN(parsed) ? 0 : parsed };
    }
  }
  return { keyFound: null, value: undefined, parsed: 0 };
};

const checkDataQuality = (history, ticker) => {
  const issues = [];
  const sample = history[0];

  // Teste rápido no primeiro item
  const probe = probePrice(sample);
  if (probe.parsed === 0 && (sample.qty !== undefined || sample.quantity !== undefined)) {
    return [
      `⚠️ ${ticker}: Dados parecem ser apenas transações (contém 'qty' mas sem preço de cotação).`,
    ];
  }

  // Varredura completa por dias com preço zero
  const badDataSamples = [];
  history.forEach((day) => {
    const { parsed, value, keyFound } = probePrice(day);
    if (!parsed || parsed <= 0) {
      badDataSamples.push({
        date: fmtDate(day.trade_date || day.date),
        keyUsed: keyFound,
        valueReceived: value,
      });
    }
  });

  if (badDataSamples.length > 0) {
    const count = badDataSamples.length;
    const sampleError = badDataSamples[0];
    issues.push(
      `🛑 ${ticker}: ${count} dia(s) com preço inválido/zerado (Ex: ${sampleError.date}).`
    );
  }

  return issues;
};
