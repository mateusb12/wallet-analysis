import { useEffect, useState } from 'react';
import { fetchDashboardData } from '../../services/walletDataService.js';
import { useAuth } from '../auth/AuthContext.jsx';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';

const categories = [
  { type: 'stock', label: 'Ações', icon: iconStocks },
  { type: 'etf', label: 'ETFs', icon: iconEtf },
  { type: 'fii', label: 'FIIs', icon: iconFiis },
];

const tickerDetails = {
  BBAS3: { sector: 'Bancos', pvp: '0,85', pl: '7,42', dy: '8,10%', roe: '12,40%' },
  MDIA3: { sector: 'Alimentos', pvp: '1,65', pl: '11,30', dy: '4,20%', roe: '14,60%' },
  WEGE3: { sector: 'Indústria', pvp: '8,20', pl: '32,10', dy: '1,30%', roe: '25,50%' },
  BBSE3: { sector: 'Seguros', pvp: '4,10', pl: '8,20', dy: '7,60%', roe: '51,20%' },
};

const defaultTickerDetails = {
  sector: 'Não informado',
  pvp: '—',
  pl: '—',
  dy: '—',
  roe: '—',
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
      contributions: contributions.map((contribution) => {
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
      }),
    };
  });
};

export default function WhereToInvest() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [loading, setLoading] = useState(true);

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
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Detalhes do ativo
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedTicker}
                  </p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(tickerDetails[selectedTicker] || defaultTickerDetails).sector}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['P/VP', 'pvp'],
                  ['P/L', 'pl'],
                  ['Dividend Yield', 'dy'],
                  ['ROE', 'roe'],
                ].map(([label, key]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {(tickerDetails[selectedTicker] || defaultTickerDetails)[key]}
                    </p>
                  </div>
                ))}
              </div>

              {selectedPosition && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Aportes
                  </p>
                  <div
                    className="grid min-w-0 gap-2 border-b border-gray-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1fr' }}
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
                        className="grid min-w-0 gap-2 py-2 text-xs"
                        style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1fr' }}
                      >
                        <span className="min-w-0 whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {formatDate(contribution.date) || `Aporte ${index + 1}`}
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
