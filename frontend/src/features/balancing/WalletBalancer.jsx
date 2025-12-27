import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ArrowRight,
  Layers,
  PieChart,
  Activity,
  TrendingUp,
  Target,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Settings,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { fetchWalletPositions } from '../../services/walletDataService.js';
import TargetConfigModal from './TargetConfigModal';

const FormatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FormatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(
    value / 100
  );

async function classifyAsset(ticker) {
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

const findPriorityPath = (tree, targets) => {
  if (!targets || !targets.macro) return null;

  const macroCandidates = Object.entries(tree).map(([key, data]) => {
    const target = targets.macro[key] || 0;
    const current = data.percentOfTotal;
    const diff = current - target;
    return { key, diff, data };
  });

  const macroUnderweight = macroCandidates
    .filter((c) => c.diff < -0.5)
    .sort((a, b) => a.diff - b.diff);

  if (macroUnderweight.length === 0) return null;

  const winnerMacro = macroUnderweight[0];

  const subTypes = winnerMacro.data.subTypes || {};
  const microCandidates = Object.entries(subTypes).map(([subKey, subData]) => {
    const parentValue = winnerMacro.data.totalValue;
    const relativeCurrent = parentValue > 0 ? (subData.value / parentValue) * 100 : 0;
    const target = targets.micro[winnerMacro.key]?.[subKey] || 0;
    const diff = relativeCurrent - target;

    return { key: subKey, diff };
  });

  const microUnderweight = microCandidates
    .filter((c) => c.diff < -1)
    .sort((a, b) => a.diff - b.diff);

  const winnerMicro = microUnderweight.length > 0 ? microUnderweight[0].key : null;

  return {
    macro: winnerMacro.key,
    micro: winnerMicro,
  };
};

const AIAnalysisReport = ({ tree, targets }) => {
  if (!tree) return null;

  const insights = [];

  const fiiData = tree.fii;
  if (fiiData && fiiData.totalValue > 0) {
    const papelVal = fiiData.subTypes['Papel']?.value || 0;
    const papelPct = (papelVal / fiiData.totalValue) * 100;

    if (papelPct > 55) {
      insights.push({
        type: 'warning',
        title: 'Exposição Excessiva em Crédito (FIIs)',
        text: `Sua carteira de FIIs está ${papelPct.toFixed(0)}% em Papel (Dívida). Isso gera dividendos agora, mas não protege contra inflação no longo prazo como Imóveis reais.`,
        action:
          'Pare de comprar Papel. Foque 100% dos próximos aportes em Tijolo (Logística/Shoppings).',
      });
    } else if (papelPct < 25) {
      insights.push({
        type: 'info',
        title: 'Oportunidade de Renda',
        text: `Você tem pouca exposição a Recebíveis (${papelPct.toFixed(0)}%). Em momentos de juros altos, você pode estar deixando dinheiro na mesa.`,
        action: 'Considere aumentar levemente a mão em FIIs de Papel High Grade.',
      });
    }
  }

  const stockData = tree.acoes;
  if (stockData && stockData.totalValue > 0) {
    const perenesVal = stockData.subTypes['Perenes (Renda/Defesa)']?.value || 0;
    const perenesPct = (perenesVal / stockData.totalValue) * 100;

    let totalStockCount = 0;
    Object.values(stockData.subTypes).forEach((sub) => {
      totalStockCount += sub.assets.length;
    });

    if (totalStockCount <= 4) {
      insights.push({
        type: 'warning',
        title: 'Alerta de Concentração (Risco Específico)',
        text: `Você tem apenas ${totalStockCount} ações na carteira (N=${totalStockCount}). Se o governo intervir em uma delas (ex: BBAS3), o impacto no seu patrimônio será devastador.`,
        action:
          'Urgente: Adicione pelo menos mais 2 ou 3 empresas de setores diferentes (Ex: Saneamento, Elétricas).',
      });
    }

    if (perenesPct > 70) {
      insights.push({
        type: 'info',
        title: 'Carteira de Ações Muito Conservadora',
        text: `Mais de ${perenesPct.toFixed(0)}% das suas ações são defensivas. É seguro, mas pode travar seu crescimento patrimonial no longo prazo.`,
        action: 'Estude adicionar empresas Cíclicas (Indústria/Varejo) ou Small Caps de qualidade.',
      });
    } else if (perenesPct < 40) {
      insights.push({
        type: 'warning',
        title: 'Alta Volatilidade em Ações',
        text: 'Sua carteira está muito exposta a ciclos econômicos (Cíclicas). Se a bolsa cair, sua volatilidade será alta.',
        action: 'Reforce a base com Bancos, Elétricas ou Seguros (Perenes).',
      });
    }
  }

  const etfData = tree.etf;
  if (etfData && etfData.totalValue > 0) {
    const fatorVal = etfData.subTypes['Específicos/Fatores']?.value || 0;
    const fatorPct = (fatorVal / etfData.totalValue) * 100;

    if (fatorPct > 40) {
      insights.push({
        type: 'warning',
        title: 'Risco de Concentração Internacional',
        text: `Você tem ${fatorPct.toFixed(0)}% de ETFs em apostas específicas (Tech/Cripto/Small Caps). Isso é agressivo demais para uma carteira passiva.`,
        action: 'Foque seus aportes no índice neutro (IVVB11/WRLD11) para diluir esse risco.',
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'success',
      title: 'Carteira Equilibrada!',
      text: 'Parabéns, seus ativos estão bem distribuídos em quantidade e estratégia. Você atingiu um ótimo equilíbrio.',
      action: 'Apenas mantenha a constância nos aportes.',
    });
  }

  return (
    <div className="mt-8 bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl p-6 border border-indigo-100 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          Análise Inteligente da Carteira
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`
              p-5 rounded-xl border flex flex-col gap-3 transition-all duration-300 hover:shadow-md
              ${
                insight.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/50'
                  : insight.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/50'
                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700/50'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {insight.type === 'warning' && (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              {insight.type === 'success' && (
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              {insight.type === 'info' && (
                <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4
                  className={`font-bold text-sm mb-1
                  ${
                    insight.type === 'warning'
                      ? 'text-amber-800 dark:text-amber-200'
                      : insight.type === 'success'
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-blue-800 dark:text-blue-200'
                  }
                `}
                >
                  {insight.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {insight.text}
                </p>
              </div>
            </div>

            {insight.action && (
              <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                <ArrowRight className="w-3 h-3" />
                <span>{insight.action}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const DriftIndicator = ({ label, currentPct, targetPct, amount, compact = false }) => {
  const diff = currentPct - targetPct;
  const isUnderweight = diff < -1;
  const isOverweight = diff > 1;

  let statusColor = 'text-emerald-600 dark:text-emerald-400';
  let barColor = 'bg-emerald-500';
  let statusText = 'No Alvo';
  let bgBadge =
    'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';

  if (isUnderweight) {
    statusColor = 'text-amber-600 dark:text-amber-400';
    barColor = 'bg-amber-500';
    statusText = 'Abaixo';
    bgBadge = 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
  } else if (isOverweight) {
    statusColor = 'text-rose-600 dark:text-rose-400';
    barColor = 'bg-rose-500';
    statusText = 'Acima';
    bgBadge = 'bg-rose-100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
  }

  if (targetPct === 0 && currentPct === 0) return null;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
          )}
          <div className="flex gap-2 mt-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">
              Meta {targetPct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${bgBadge} ${statusColor} mb-1 shadow-sm`}
          >
            {statusText}
          </div>
        </div>
      </div>
      <div
        className={`relative w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2.5'}`}
      >
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-white z-20 opacity-40"
          style={{ left: `${Math.min(targetPct, 100)}%` }}
        />
        <div
          className={`absolute top-0 bottom-0 left-0 ${barColor} transition-all duration-700 ease-out rounded-full shadow-sm`}
          style={{ width: `${Math.min(currentPct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {currentPct.toFixed(1)}% carteira
        </span>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          {FormatCurrency(amount)}
        </span>
      </div>
    </div>
  );
};

const AssetListTable = ({ assets, totalValue, isUnclassified }) => {
  return (
    <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
      {isUnclassified && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-xs font-bold border-b border-red-100 dark:border-red-900/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          não foi possível classificar esse ativo
        </div>
      )}
      <table className="w-full text-xs text-left">
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3">Ativo</th>
            <th className="px-4 py-3 text-right">Qtd</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3 text-center w-28">Peso Relativo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {assets.map((asset) => {
            const assetValue = asset.qty * asset.price;
            const assetWeight = totalValue > 0 ? (assetValue / totalValue) * 100 : 0;
            return (
              <tr
                key={asset.ticker}
                className="group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200 cursor-default"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-500 transition-colors"></div>
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {asset.ticker}
                      </span>
                      <span className="block text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">
                        {asset.sector}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {asset.qty}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200 font-mono group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {FormatCurrency(assetValue)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col gap-1 items-end w-full">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-400 dark:bg-blue-500 h-full rounded-full"
                        style={{ width: `${assetWeight}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-gray-400 font-mono">
                      {assetWeight.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DEFAULT_TARGETS = {
  macro: { fii: 34, acoes: 33, etf: 33, outros: 0 },
  micro: {
    fii: {
      Tijolo: 60,
      Papel: 40,
    },
    acoes: {
      'Perenes (Renda/Defesa)': 60,
      'Cíclicas (Valor/Crescimento)': 40,
    },
    etf: {
      'Base Global': 70,
      'Específicos/Fatores': 30,
    },
    outros: { Indefinido: 0 },
  },
};

const WalletBalancer = () => {
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem('wallet_balancer_targets');
    return saved ? JSON.parse(saved) : DEFAULT_TARGETS;
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [portfolioTree, setPortfolioTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({ fii: true, acoes: false, etf: false, outros: true });
  const [expandedSub, setExpandedSub] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAndClassifyWallet();
  }, []);

  const handleSaveTargets = (newTargets) => {
    setTargets(newTargets);
    localStorage.setItem('wallet_balancer_targets', JSON.stringify(newTargets));
    setIsConfigOpen(false);
  };

  const handleResetTargets = () => {
    if (window.confirm('Deseja restaurar as configurações padrão (Modelo Binário)?')) {
      setTargets(DEFAULT_TARGETS);
      localStorage.setItem('wallet_balancer_targets', JSON.stringify(DEFAULT_TARGETS));
      setIsConfigOpen(false);
    }
  };

  const loadAndClassifyWallet = async () => {
    setLoading(true);
    try {
      const positions = await fetchWalletPositions();

      const aggregated = {};
      positions.forEach((p) => {
        if (!aggregated[p.ticker]) {
          aggregated[p.ticker] = {
            ticker: p.ticker,
            qty: 0,
            price: p.current_price || p.purchase_price,
            totalVal: 0,
          };
        }
        aggregated[p.ticker].qty += p.qty;
      });

      Object.values(aggregated).forEach((item) => {
        item.totalVal = item.qty * item.price;
      });

      const uniqueTickers = Object.values(aggregated);
      const totalPortfolioValue = uniqueTickers.reduce((acc, curr) => acc + curr.totalVal, 0);

      const classifications = await Promise.all(
        uniqueTickers.map(async (asset) => {
          const cls = await classifyAsset(asset.ticker);
          return { ...asset, classification: cls };
        })
      );

      const newTree = {
        fii: { totalValue: 0, percentOfTotal: 0, subTypes: {} },
        acoes: { totalValue: 0, percentOfTotal: 0, subTypes: {} },
        etf: { totalValue: 0, percentOfTotal: 0, subTypes: {} },
        outros: { totalValue: 0, percentOfTotal: 0, subTypes: {} },
      };

      classifications.forEach((item) => {
        const cls = item.classification;
        const typeStr = cls.detected_type || 'Indefinido';
        const sectorStr = cls.sector || 'Indefinido';

        let macro = 'outros';
        let subType = 'Indefinido';

        if (typeStr.startsWith('FII')) macro = 'fii';
        else if (typeStr.startsWith('ETF')) macro = 'etf';
        else if (typeStr.startsWith('Ação')) macro = 'acoes';

        if (macro === 'acoes' || macro === 'etf') {
          subType = sectorStr.replace(/^(Ações|ETF)\s-\s/, '');
        } else if (macro === 'fii') {
          if (typeStr.includes('Tijolo')) {
            subType = 'Tijolo';
          } else {
            subType = 'Papel';
          }
        }

        if (!newTree[macro]) newTree[macro] = { totalValue: 0, percentOfTotal: 0, subTypes: {} };

        newTree[macro].totalValue += item.totalVal;

        if (!newTree[macro].subTypes[subType]) {
          newTree[macro].subTypes[subType] = { value: 0, assets: [] };
        }

        newTree[macro].subTypes[subType].value += item.totalVal;
        newTree[macro].subTypes[subType].assets.push({
          ticker: item.ticker,
          sector: typeStr.replace(/^(Ação|FII|ETF)\s-\s/, ''),
          qty: item.qty,
          price: item.price,
        });
      });

      Object.keys(newTree).forEach((key) => {
        if (totalPortfolioValue > 0) {
          newTree[key].percentOfTotal = (newTree[key].totalValue / totalPortfolioValue) * 100;
        }
      });

      setPortfolioTree(newTree);
    } catch (error) {
      console.error('Critical error building wallet tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const priorityPath = useMemo(
    () => (portfolioTree ? findPriorityPath(portfolioTree, targets) : null),
    [portfolioTree, targets]
  );

  useEffect(() => {
    if (priorityPath) {
      setExpanded((prev) => ({ ...prev, [priorityPath.macro]: true }));
    }
  }, [priorityPath]);

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubExpand = (e, uniqueKey) => {
    e.stopPropagation();
    setExpandedSub((prev) => ({ ...prev, [uniqueKey]: !prev[uniqueKey] }));
  };

  const handleCopyTree = () => {
    if (!portfolioTree) return;
    const jsonString = JSON.stringify(portfolioTree, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Analisando Carteira...</h3>
        <p className="text-sm text-gray-500">Classificando seus ativos em tempo real</p>
      </div>
    );
  }

  if (!portfolioTree) return null;

  return (
    <>
      <TargetConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        currentTargets={targets}
        onSave={handleSaveTargets}
        onReset={handleResetTargets}
      />

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm">
            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Inteligência de Aporte
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Baseado nos seus ativos reais (Classificação Binária)
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Configurar Metas"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              onClick={handleCopyTree}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Copiar JSON da árvore"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={loadAndClassifyWallet}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Recarregar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(portfolioTree).map(([assetClass, data]) => {
            if (data.totalValue === 0 && (!targets.macro || !targets.macro[assetClass]))
              return null;

            const target = targets.macro?.[assetClass] || 0;
            const currentPct = data.percentOfTotal;
            const isExpanded = expanded[assetClass];
            const isPriority = priorityPath?.macro === assetClass;
            const isDimmed = priorityPath && !isPriority;

            return (
              <div
                key={assetClass}
                className={`
                  relative rounded-2xl transition-all duration-500 ease-out border group/card
                  ${
                    isPriority
                      ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-500 shadow-xl ring-2 ring-blue-50 dark:ring-blue-900/30 scale-[1.02] z-10'
                      : isDimmed
                        ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 opacity-60 hover:opacity-100 scale-95 grayscale-[0.5] hover:grayscale-0'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }
                `}
              >
                {isPriority && (
                  <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg z-20 flex items-center gap-1.5 uppercase tracking-wide animate-in fade-in zoom-in duration-300">
                    <TrendingUp className="w-3 h-3" /> Recomendação do Mês
                  </div>
                )}

                <div className="p-5 cursor-pointer" onClick={() => toggleExpand(assetClass)}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`
                          w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300
                          ${isExpanded || isPriority ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-500 group-hover/card:bg-blue-50 group-hover/card:text-blue-600'}
                        `}
                      >
                        {assetClass === 'fii' && <Layers className="w-5 h-5" />}
                        {assetClass === 'acoes' && <Activity className="w-5 h-5" />}
                        {assetClass === 'etf' && <PieChart className="w-5 h-5" />}
                        {assetClass === 'outros' && <AlertTriangle className="w-5 h-5" />}
                      </div>

                      <div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                          {assetClass === 'acoes' ? 'Ações' : assetClass}
                        </h4>
                        {!isExpanded && !isPriority && (
                          <span className="text-xs text-gray-400 animate-in fade-in">
                            Clique para detalhes
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-3xl font-bold tracking-tight ${isPriority ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
                      >
                        {FormatPercent(currentPct)}
                      </span>
                    </div>
                  </div>

                  <DriftIndicator
                    label=""
                    currentPct={currentPct}
                    targetPct={target}
                    amount={data.totalValue}
                  />
                </div>

                {isExpanded && data.subTypes && (
                  <div className="bg-gray-50/80 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 p-4 sm:p-6 space-y-3 rounded-b-2xl">
                    {Object.entries(data.subTypes).map(([subType, subData]) => {
                      const uniqueKey = `${assetClass}-${subType}`;
                      const isSubExpanded = expandedSub[uniqueKey];
                      const subTarget = targets.micro?.[assetClass]?.[subType] || 0;

                      const relativePercent =
                        data.totalValue > 0 ? (subData.value / data.totalValue) * 100 : 0;
                      const isSubPriority = isPriority && priorityPath?.micro === subType;
                      const isUnclassified = subType === 'Indefinido' || assetClass === 'outros';

                      return (
                        <div
                          key={subType}
                          onClick={(e) => toggleSubExpand(e, uniqueKey)}
                          className={`
                                  group/sub relative bg-white dark:bg-gray-800 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden
                                  ${
                                    isSubPriority
                                      ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900/30 shadow-md'
                                      : isSubExpanded
                                        ? 'border-gray-300 dark:border-gray-600'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                  }
                              `}
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-200 
                              ${isSubPriority ? 'bg-blue-600' : isSubExpanded ? 'bg-gray-400' : 'bg-transparent group-hover/sub:bg-blue-200'}
                            `}
                          ></div>

                          <div className="p-4 pl-5 transition-all duration-200 group-hover/sub:pl-6">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold text-base transition-colors ${
                                    isSubPriority
                                      ? 'text-blue-700 dark:text-blue-400'
                                      : isSubExpanded
                                        ? 'text-gray-900 dark:text-gray-100'
                                        : 'text-gray-600 dark:text-gray-300'
                                  }`}
                                >
                                  {subType}
                                </span>

                                {isSubPriority && (
                                  <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    Foco
                                  </span>
                                )}

                                {isSubExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                                ) : (
                                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover/sub:text-blue-400 group-hover/sub:translate-x-1 transition-all ml-auto" />
                                )}
                              </div>
                            </div>

                            <DriftIndicator
                              label=""
                              currentPct={relativePercent}
                              targetPct={subTarget}
                              amount={subData.value}
                              compact={true}
                            />
                          </div>

                          {isSubExpanded && subData.assets && (
                            <div className="px-4 pb-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700 pt-2 animate-in slide-in-from-top-2">
                              <AssetListTable
                                assets={subData.assets}
                                totalValue={subData.value}
                                isUnclassified={isUnclassified}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {}
        <AIAnalysisReport tree={portfolioTree} targets={targets} />
      </div>
    </>
  );
};

export default WalletBalancer;
