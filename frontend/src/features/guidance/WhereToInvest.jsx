import { useEffect, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { fetchDashboardData, fetchTickerFundamentals } from '../../services/walletDataService.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Tooltip } from '../../components/Tooltip.jsx';
import {
  formatDateTimeLong,
  formatElapsedPeriodCompact,
  formatFullDate,
  formatShortMonthDate,
} from '../../utils/dateUtils.js';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';

const categories = [
  { type: 'stock', label: 'Ações', icon: iconStocks },
  { type: 'etf', label: 'ETFs', icon: iconEtf },
  { type: 'fii', label: 'FIIs', icon: iconFiis },
];

const metricDescriptions = {
  dy: 'Mostra os dividendos pagos nos últimos 12 meses em relação ao preço atual. Ex.: DY de 6% em uma ação de R$ 100 representa cerca de R$ 6 em dividendos no período.',
  roe: 'Mede quanto lucro líquido a empresa gera com o patrimônio dos acionistas. Ex.: ROE de 10% significa R$ 10 de lucro para cada R$ 100 de patrimônio.',
  cagr5:
    'Mostra o crescimento médio anualizado do preço da ação nos últimos 5 anos. O cálculo usa os preços ajustados para considerar os proventos distribuídos.',
};

const FUNDAMENTALS_CACHE_KEY = 'wallet-analysis:ticker-fundamentals:v19';

const readFundamentalsCache = (ticker) => {
  try {
    const cache = JSON.parse(localStorage.getItem(FUNDAMENTALS_CACHE_KEY) || '{}');
    return cache[ticker] || null;
  } catch {
    return null;
  }
};

const saveFundamentalsCache = (ticker, data) => {
  try {
    const cache = JSON.parse(localStorage.getItem(FUNDAMENTALS_CACHE_KEY) || '{}');
    cache[ticker] = { data, fetchedAt: new Date().toISOString() };
    localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    return undefined;
  }
};

const fetchAndCacheFundamentals = async (ticker, force = false) => {
  const cached = !force && readFundamentalsCache(ticker);
  if (cached) return cached;

  const data = await fetchTickerFundamentals(ticker, { fresh: force });
  const cachedData = { data, fetchedAt: new Date().toISOString() };
  saveFundamentalsCache(ticker, data);
  return cachedData;
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR');
};

const formatMetric = (value, percent = false) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';

  const numericValue = percent ? Number(value) * 100 : Number(value);
  return `${numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${percent ? '%' : ''}`;
};

const hasValue = (value) => value !== null && value !== undefined && !Number.isNaN(Number(value));

const formatShares = (value) => {
  if (!hasValue(value)) return '—';

  const numericValue = Number(value);
  const absoluteValue = Math.abs(numericValue);
  const formatUnit = (unitValue, unit) =>
    `${unitValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${unit}`;

  if (absoluteValue >= 1e12) return formatUnit(numericValue / 1e12, 'trilhões');
  if (absoluteValue >= 1e9) return formatUnit(numericValue / 1e9, 'bilhões');
  if (absoluteValue >= 1e6) return formatUnit(numericValue / 1e6, 'milhões');

  return numericValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

const formatLargeCurrency = (value) => {
  if (!hasValue(value)) return '—';

  const absoluteValue = Math.abs(Number(value));
  const formatUnit = (unitValue, unit) =>
    `R$ ${unitValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${unit}`;

  if (absoluteValue >= 1e12) return formatUnit(Number(value) / 1e12, 'trilhões');
  if (absoluteValue >= 1e9) return formatUnit(Number(value) / 1e9, 'bilhões');
  if (absoluteValue >= 1e6) return formatUnit(Number(value) / 1e6, 'milhões');

  return formatCurrency(value);
};

const getMetricDescription = (key, fundamentals) => {
  if (
    key === 'pvp' &&
    hasValue(fundamentals?.pvp) &&
    hasValue(fundamentals?.price) &&
    hasValue(fundamentals?.shares_outstanding)
  ) {
    const bookValuePerShare = hasValue(fundamentals?.book_value_per_share)
      ? Number(fundamentals.book_value_per_share)
      : Number(fundamentals.price) / Number(fundamentals.pvp);
    const equityValue = bookValuePerShare * Number(fundamentals.shares_outstanding);

    return (
      <span className="block text-left">
        <ul className="list-disc pl-4">
          <li>Valor patrimonial total (VPT) = {formatLargeCurrency(equityValue)}</li>
          <li>Quantidade de ações = {formatShares(fundamentals.shares_outstanding)}</li>
          <li>Valor patrimonial por ação (VP) = {formatCurrency(bookValuePerShare)}</li>
        </ul>
        <span className="mt-1 block">
          Valor atual da ação (P) = {formatCurrency(fundamentals.price)}
        </span>
        <span className="mt-1 block">
          P/VP = {formatCurrency(fundamentals.price)} / {formatCurrency(bookValuePerShare)} ={' '}
          {formatMetric(fundamentals.pvp)}
        </span>
      </span>
    );
  }

  if (key === 'pl' && hasValue(fundamentals?.price) && hasValue(fundamentals?.eps)) {
    const totalProfit = hasValue(fundamentals?.shares_outstanding)
      ? Number(fundamentals.eps) * Number(fundamentals.shares_outstanding)
      : null;

    return (
      <span className="block text-left">
        <span className="block">Valor atual da ação = {formatCurrency(fundamentals.price)}</span>
        <span className="block">
          Quantidade de ações = {formatShares(fundamentals.shares_outstanding)}
        </span>
        <span className="block">Lucro total estimado = {formatLargeCurrency(totalProfit)}</span>
        <span className="block">Lucro por ação = {formatCurrency(fundamentals.eps)}</span>
        <span className="block">
          P/L = {formatMetric(fundamentals.price)} / {formatMetric(fundamentals.eps)} ={' '}
          {formatMetric(fundamentals.pl)}
        </span>
      </span>
    );
  }

  if (key === 'roe' && hasValue(fundamentals?.roe)) {
    const equityValue =
      hasValue(fundamentals?.book_value_per_share) && hasValue(fundamentals?.shares_outstanding)
        ? Number(fundamentals.book_value_per_share) * Number(fundamentals.shares_outstanding)
        : null;
    const estimatedNetIncome = equityValue === null ? null : Number(fundamentals.roe) * equityValue;

    return (
      <span className="block text-left">
        <span className="block">
          Lucro líquido estimado = {formatLargeCurrency(estimatedNetIncome)}
        </span>
        <span className="block">Patrimônio líquido (VPT) = {formatLargeCurrency(equityValue)}</span>
        <span className="block">
          ROE ≈ lucro líquido ÷ patrimônio líquido = {formatMetric(fundamentals.roe, true)}
        </span>
      </span>
    );
  }

  if (key === 'pvp') {
    return 'Compara o preço de mercado da ação com o valor patrimonial correspondente.';
  }

  if (key === 'pl') {
    return 'Compara o preço da ação com o lucro anual por ação.';
  }

  if (key === 'cagr5' && fundamentals?.annual_returns?.length) {
    return (
      <span className="block text-left">
        <span className="block">Retorno anual:</span>
        {fundamentals.annual_returns.map(({ year, value }) => (
          <span className="block" key={year}>
            {year}:{' '}
            <span className={value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : ''}>
              {formatMetric(value, true)}
            </span>
          </span>
        ))}
      </span>
    );
  }

  if (key === 'cagr5' && hasValue(fundamentals?.cagr_5y)) {
    return `Nos últimos 5 anos, o preço da ação teve um crescimento médio anual de ${formatMetric(fundamentals.cagr_5y, true)}. Isso representa a taxa anualizada de valorização no período.`;
  }

  const dividendPerShare =
    hasValue(fundamentals?.dy) && hasValue(fundamentals?.price)
      ? Number(fundamentals.dy) * Number(fundamentals.price)
      : hasValue(fundamentals?.dividend_per_share)
        ? Number(fundamentals.dividend_per_share)
        : null;

  if (
    key === 'dy' &&
    hasValue(dividendPerShare) &&
    hasValue(fundamentals?.price) &&
    hasValue(fundamentals?.dy)
  ) {
    const ticker = fundamentals.ticker || 'este ativo';
    const dividendYield = formatMetric(fundamentals.dy, true);

    return (
      <span className="block text-left">
        <span className="block">
          Dividendos pagos por cada ação de {ticker} (nos últimos 12 meses) ={' '}
          {formatCurrency(dividendPerShare)}
        </span>
        <span className="mt-1 block">
          Preço de uma ação individual de {ticker} (hoje) = {formatCurrency(fundamentals.price)}
        </span>
        <span className="mt-1 block">
          Isso significa que os dividendos representam {dividendYield} do preço da ação.
        </span>
      </span>
    );
  }

  return metricDescriptions[key];
};

const groupPositions = (positions, transactions) => {
  const groups = new Map();

  positions.forEach((position) => {
    const key = `${position.type}-${position.ticker}`;
    const current = groups.get(key);
    const qty = Number(position.qty) || 0;
    const totalValue = Number(position.total_value) || 0;

    if (current) {
      current.qty += qty;
      current.total_value_current += totalValue;
      current.sourcePositions.push(position);
      return;
    }

    groups.set(key, {
      ...position,
      qty,
      total_value_current: totalValue,
      sourcePositions: [position],
    });
  });

  return Array.from(groups.values()).map((group) => {
    const groupTransactions = transactions.filter(
      (transaction) =>
        transaction.ticker === group.ticker &&
        (transaction.asset_type || transaction.type) === group.type
    );
    const contributions = groupTransactions.length ? groupTransactions : group.sourcePositions;

    return {
      ...group,
      contributions: contributions
        .map((contribution) => {
          const qty = Number(contribution.qty) || 0;
          const price = Number(contribution.price ?? contribution.purchase_price) || 0;
          const totalValue =
            Number(contribution.total_value ?? contribution.total_value_current) || price * qty;

          return {
            qty,
            price,
            totalValue,
            date: contribution.trade_date || contribution.purchaseDate,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    };
  });
};

export default function WhereToInvest() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickerFundamentals, setTickerFundamentals] = useState(null);
  const [fundamentalsFetchedAt, setFundamentalsFetchedAt] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedTicker) {
      setTickerFundamentals(null);
      setFundamentalsFetchedAt(null);
      return undefined;
    }

    let isMounted = true;
    const cached = readFundamentalsCache(selectedTicker);

    if (cached) {
      setTickerFundamentals(cached.data);
      setFundamentalsFetchedAt(cached.fetchedAt);
      setFundamentalsLoading(false);
      return undefined;
    }

    setFundamentalsLoading(true);

    fetchAndCacheFundamentals(selectedTicker)
      .then(({ data, fetchedAt }) => {
        if (isMounted) {
          setTickerFundamentals(data);
          setFundamentalsFetchedAt(fetchedAt);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTickerFundamentals(null);
          setFundamentalsFetchedAt(null);
        }
      })
      .finally(() => {
        if (isMounted) setFundamentalsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTicker]);

  const refreshFundamentals = () => {
    if (!selectedTicker || fundamentalsLoading) return;

    try {
      const cache = JSON.parse(localStorage.getItem(FUNDAMENTALS_CACHE_KEY) || '{}');
      delete cache[selectedTicker];
      localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // A atualização ainda deve continuar mesmo se o cache local estiver indisponível.
    }

    setFundamentalsLoading(true);
    fetchAndCacheFundamentals(selectedTicker, true)
      .then(({ data, fetchedAt }) => {
        setTickerFundamentals(data);
        setFundamentalsFetchedAt(fetchedAt);
      })
      .catch(() => {
        setTickerFundamentals(null);
        setFundamentalsFetchedAt(null);
      })
      .finally(() => setFundamentalsLoading(false));
  };

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    fetchDashboardData()
      .then((data) => {
        if (isMounted) {
          setPositions(data.positions || []);
          setTransactions(data.transactions || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPositions([]);
          setTransactions([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const selected = categories.find((category) => category.type === selectedCategory);
  const selectedPositions = groupPositions(
    positions.filter((position) => position.type === selectedCategory),
    transactions
  );
  const selectedPosition = selectedPositions.find((position) => position.ticker === selectedTicker);
  const renderMetricCard = ([label, key]) => (
    <div
      key={key}
      className="relative h-24 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    >
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span>{label}</span>
        {key !== 'price' && key !== 'allTimeHigh' && (
          <Tooltip content={getMetricDescription(key, tickerFundamentals)} maxTooltipWidth="24rem">
            <span aria-label={`Explicação de ${label}`} className="inline-flex cursor-help">
              <Info className="h-3.5 w-3.5" />
            </span>
          </Tooltip>
        )}
      </div>
      <p className="mt-1 font-semibold text-gray-900 dark:text-white">
        {key === 'price' && formatCurrency(tickerFundamentals?.price)}
        {key === 'allTimeHigh' &&
          (hasValue(tickerFundamentals?.all_time_high)
            ? formatCurrency(tickerFundamentals.all_time_high)
            : '—')}
        {key === 'pvp' && formatMetric(tickerFundamentals?.pvp)}
        {key === 'pl' && formatMetric(tickerFundamentals?.pl)}
        {key === 'dy' && formatMetric(tickerFundamentals?.dy, true)}
        {key === 'roe' && formatMetric(tickerFundamentals?.roe, true)}
        {key === 'cagr5' && formatMetric(tickerFundamentals?.cagr_5y, true)}
      </p>
      {key === 'allTimeHigh' && tickerFundamentals?.all_time_high_date && (
        <Tooltip
          content={formatShortMonthDate(tickerFundamentals.all_time_high_date)}
          className="!absolute !bottom-3 !right-3"
        >
          <p className="cursor-help whitespace-nowrap border-b border-dashed border-gray-500 text-xs text-gray-500 dark:border-gray-400 dark:text-gray-400">
            ({formatElapsedPeriodCompact(tickerFundamentals.all_time_high_date)} atrás)
          </p>
        </Tooltip>
      )}
    </div>
  );

  return (
    <section className="w-full min-w-0 max-w-none space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Onde aportar?</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Selecione uma categoria para ver seus ativos.
        </p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.type;

          return (
            <button
              key={category.type}
              type="button"
              onClick={() => {
                setSelectedCategory(isSelected ? null : category.type);
                setSelectedTicker(null);
              }}
              className={`relative flex w-full items-center rounded-2xl border p-5 text-left transition-all duration-300 ${
                isSelected
                  ? 'scale-[1.02] border-blue-600 bg-blue-600 shadow-lg shadow-blue-500/30'
                  : 'border-gray-200 bg-white shadow hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700'
              }`}
            >
              <div
                className={`mr-4 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                  isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <img
                  src={category.icon}
                  alt={category.label}
                  className="h-full w-full object-cover"
                />
              </div>
              <span
                className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}
              >
                {category.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
            <img src={selected.icon} alt={selected.label} className="h-8 w-8 object-cover" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Meus {selected.label}
            </h2>
          </div>

          {loading ? (
            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">Carregando ativos...</p>
          ) : selectedPositions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {selectedPositions.map((position) => {
                const positionKey = `${position.type}-${position.ticker}`;
                const isSelectedTicker = selectedTicker === position.ticker;

                return (
                  <div key={positionKey}>
                    <button
                      type="button"
                      data-testid={`position-card-${positionKey}`}
                      aria-expanded={isSelectedTicker}
                      onClick={() => {
                        setSelectedTicker(isSelectedTicker ? null : position.ticker);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-gray-100 p-3 text-left dark:border-gray-700"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white">{position.ticker}</p>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {position.name}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {position.qty} cotas
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(position.total_value_current)}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
              Você ainda não possui ativos nessa categoria.
            </p>
          )}

          {selectedTicker && (
            <footer className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Detalhes do ativo
                    </p>
                    <button
                      type="button"
                      onClick={refreshFundamentals}
                      disabled={fundamentalsLoading}
                      aria-label="Atualizar fundamentos"
                      className="rounded-md p-1 text-gray-500 transition hover:bg-gray-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${fundamentalsLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <Tooltip
                      content={`Última consulta: ${formatDateTimeLong(fundamentalsFetchedAt, { includeYear: true })}`}
                    >
                      <span
                        aria-label="Data da última consulta"
                        className="inline-flex cursor-help text-gray-500 dark:text-gray-400"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedTicker}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['Preço atual', 'price'],
                    ['Máxima histórica', 'allTimeHigh'],
                    ['CAGR 5 anos', 'cagr5'],
                  ].map(renderMetricCard)}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['P/VP', 'pvp'],
                    ['P/L', 'pl'],
                    ['Dividend Yield', 'dy'],
                    ['ROE', 'roe'],
                  ].map(renderMetricCard)}
                </div>
              </div>

              {selectedPosition && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Aportes
                  </p>
                  <div
                    className="grid w-fit max-w-full min-w-0 gap-4 border-b border-gray-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    style={{ gridTemplateColumns: '220px 90px 120px 110px' }}
                  >
                    <span className="min-w-0 whitespace-nowrap">Data</span>
                    <span className="min-w-0 whitespace-nowrap text-right">Quantidade</span>
                    <span className="min-w-0 whitespace-nowrap text-right">Valor unitário</span>
                    <span className="min-w-0 whitespace-nowrap text-right">Custo total</span>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedPosition.contributions.map((contribution, index) => (
                      <div
                        key={`${selectedTicker}-contribution-${index}`}
                        className="grid w-fit max-w-full min-w-0 gap-4 py-2 text-xs"
                        style={{ gridTemplateColumns: '220px 90px 120px 110px' }}
                      >
                        <span className="min-w-0 whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {formatFullDate(contribution.date) || `Aporte ${index + 1}`}
                        </span>
                        <span className="min-w-0 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                          {contribution.qty} cotas
                        </span>
                        <span className="min-w-0 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(contribution.price)}
                        </span>
                        <span className="min-w-0 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(contribution.totalValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </footer>
          )}
        </div>
      )}
    </section>
  );
}
