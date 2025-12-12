import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { TrendingUp, Search, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { formatChartDate } from '../utils/dateUtils.js';
import { fetchB3Prices } from '../services/b3service.js';

// Função auxiliar para calcular o tempo decorrido
const getTimeElapsed = (dateString) => {
  if (!dateString) return '-';
  const start = new Date(dateString);
  const end = new Date();

  // Diferença em milissegundos
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays} dias`;

  const years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  // Ajuste se o mês atual for anterior ao mês de compra
  if (months < 0 || (months === 0 && end.getDate() < start.getDate())) {
    months += 12;
    if (end.getMonth() < start.getMonth()) {
      // Ajuste de ano já coberto pela lógica de meses
    }
  }

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  if (totalMonths < 12) {
    return `${totalMonths} meses`;
  }

  const displayYears = Math.floor(totalMonths / 12);
  const displayMonths = totalMonths % 12;

  if (displayMonths === 0) return `${displayYears} anos`;
  return `${displayYears} a, ${displayMonths} m`;
};

export default function Contributions() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (user?.id) fetchPurchases();
  }, [user]);

  const fetchPurchases = async () => {
    try {
      // 1. Buscar histórico de compras
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (!response.ok) throw new Error('Falha ao buscar aportes');

      const data = await response.json();

      // 2. Identificar Tickers Únicos
      const uniqueTickers = [...new Set(data.map((item) => item.ticker))];
      const currentPricesMap = {};

      // 3. Buscar preço atual para cada ticker
      await Promise.all(
        uniqueTickers.map(async (ticker) => {
          try {
            const { data: priceData } = await fetchB3Prices(ticker, 1, 1);
            if (priceData && priceData.length > 0) {
              currentPricesMap[ticker] = parseFloat(priceData[0].close);
            }
          } catch (err) {
            console.error(`Erro ao buscar preço para ${ticker}`, err);
          }
        })
      );

      // 4. Combinar dados e calcular rentabilidade
      const enrichedData = data.map((item) => {
        const currentPrice = currentPricesMap[item.ticker] || null;
        let profitValue = 0;
        let profitPercent = 0;

        if (currentPrice) {
          const totalPaid = Number(item.price) * Number(item.qty);
          const totalCurrent = currentPrice * Number(item.qty);
          profitValue = totalCurrent - totalPaid;
          profitPercent = ((currentPrice - Number(item.price)) / Number(item.price)) * 100;
        }

        return {
          ...item,
          currentPrice,
          profitValue,
          profitPercent,
          hasPriceData: !!currentPrice,
        };
      });

      // 5. Ordenação em 3 Camadas
      const sorted = enrichedData.sort((a, b) => {
        const dateA = new Date(a.trade_date);
        const dateB = new Date(b.trade_date);

        // Camada 1: Data (Decrescente - mais recente primeiro)
        const dateDiff = dateB - dateA;
        if (dateDiff !== 0) return dateDiff;

        // Camada 2: Agrupamento por Tipo (ETF -> FII -> STOCK)
        // Se quiser outra ordem de grupos, precisaria de um mapa de pesos, mas alfabética funciona bem aqui
        if (a.type < b.type) return -1;
        if (a.type > b.type) return 1;

        // Camada 3: Rentabilidade % (Decrescente - maior lucro primeiro)
        // Isso coloca os destaques verdes no topo de cada grupo
        return b.profitPercent - a.profitPercent;
      });

      setPurchases(sorted);
    } catch (error) {
      console.error('Erro ao buscar aportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((item) => {
    const matchesSearch =
      item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeColor = (type) => {
    switch (type) {
      case 'stock':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'fii':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'etf':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[90rem] mx-auto pb-20">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-600" />
            Meus Aportes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Histórico completo de negociações ordenado por data, tipo e rentabilidade
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar ativo..."
              className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Todos os Tipos</option>
            <option value="stock">Ações</option>
            <option value="fii">FIIs</option>
            <option value="etf">ETFs</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Calculando rentabilidade histórica...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 font-medium text-center">Data</th>
                  <th className="px-6 py-3 font-medium text-center">Ativo</th>
                  <th className="px-6 py-3 font-medium text-center">Tipo</th>
                  <th className="px-6 py-3 font-medium text-center">Quantidade</th>
                  <th className="px-6 py-3 font-medium text-center">Preço por Unidade</th>
                  <th className="px-6 py-3 font-medium text-center">Total Pago</th>
                  <th className="px-6 py-3 font-medium text-center border-l border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> Tempo
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium text-center">Rentab. (R$)</th>
                  <th className="px-6 py-3 font-medium text-center">Rentab. (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((item) => {
                    const isProfit = item.profitValue >= 0;
                    const colorClass = isProfit
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400';
                    const bgClass = isProfit
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20';

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-center whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {formatChartDate(item.trade_date)}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-900 dark:text-white">
                          {item.ticker}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(item.type)}`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-900 dark:text-white">
                          {item.qty}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">
                          {Number(item.price).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white">
                          {(Number(item.price) * Number(item.qty)).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 border-l border-gray-100 dark:border-gray-700 font-medium text-xs">
                          {getTimeElapsed(item.trade_date)}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${colorClass}`}>
                          {item.hasPriceData ? (
                            item.profitValue.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.hasPriceData ? (
                            <div
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${bgClass} ${colorClass}`}
                            >
                              {isProfit ? (
                                <ArrowUp className="w-3 h-3 mr-1" />
                              ) : (
                                <ArrowDown className="w-3 h-3 mr-1" />
                              )}
                              {item.profitPercent.toFixed(2)}%
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">S/ Dados</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      Nenhum aporte encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
