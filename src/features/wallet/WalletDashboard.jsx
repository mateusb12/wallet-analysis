import React, { useState, useEffect } from 'react';
import {
  fetchWalletPositions,
  fetchWalletPerformanceHistory,
} from '../../services/walletDataService.js';
import WalletHistoryChart from './WalletHistoryChart.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-3 rounded-lg shadow-lg text-sm z-50">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-1 max-w-[200px] leading-tight">
          {data.name}
        </p>
        <p className="text-blue-600 dark:text-blue-400 font-mono font-bold">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            data.value
          )}
        </p>
      </div>
    );
  }
  return null;
};

const CATEGORIES = {
  total: { label: 'Total', benchmark: 'CDI' },
  stock: { label: 'Ações', benchmark: 'IBOV' },
  etf: { label: 'ETFs', benchmark: 'S&P 500' },
  fii: { label: 'FIIs', benchmark: 'IFIX' },
};

function WalletDashboard() {
  const [positions, setPositions] = useState([]);
  const [historyData, setHistoryData] = useState({ stock: [], etf: [], fii: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [posData, histData] = await Promise.all([
          fetchWalletPositions(),
          fetchWalletPerformanceHistory(12),
        ]);
        setPositions(posData);
        setHistoryData(histData);
      } catch (error) {
        console.error('Failed to load wallet data', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredPositions = positions.filter((p) => p.type === activeTab);
  const filteredHistory = historyData[activeTab] || [];

  const totalValue = filteredPositions.reduce((acc, curr) => acc + curr.total_value, 0);
  const totalAssets = filteredPositions.length;

  const largestPosition = filteredPositions.reduce(
    (prev, current) => (prev.total_value > current.total_value ? prev : current),
    { ticker: '-', total_value: 0, name: '' }
  );

  const largestShare = totalValue > 0 ? (largestPosition.total_value / totalValue) * 100 : 0;

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

  if (loading) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Carregando carteira...</div>;
  }

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          Dashboard: {CATEGORIES[activeTab].label}
        </h2>

        {}
        <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
          {Object.entries(CATEGORIES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === key
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Patrimônio em {CATEGORIES[activeTab].label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              totalValue
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Qtd. Ativos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAssets}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Maior Posição</p>
          <p className="text-2xl font-bold text-blue-500">{largestPosition.ticker}</p>
          <p className="text-xs text-gray-400">
            {largestPosition.ticker !== '-' &&
              `${largestPosition.name.substring(0, 15)}... (${largestShare.toFixed(0)}%)`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 flex justify-between items-center">
            <span>Performance vs {CATEGORIES[activeTab].benchmark}</span>
            <span className="text-xs font-normal text-gray-500 border border-gray-300 dark:border-gray-600 rounded px-2 py-1">
              Últimos 12 meses
            </span>
          </h3>
          {filteredHistory.length > 0 ? (
            <WalletHistoryChart
              data={filteredHistory}
              benchmarkName={CATEGORIES[activeTab].benchmark}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Dados insuficientes para gráfico
            </div>
          )}
        </div>

        {}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200 w-full text-left">
            Alocação ({CATEGORIES[activeTab].label})
          </h3>
          {filteredPositions.length > 0 ? (
            <>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredPositions}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="total_value"
                      nameKey="name"
                    >
                      {filteredPositions.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {filteredPositions.map((p, index) => (
                  <div
                    key={p.ticker}
                    className="flex items-center text-xs text-gray-600 dark:text-gray-300"
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-1"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></span>
                    {p.ticker}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Nenhum ativo nesta categoria
            </div>
          )}
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Detalhamento: {CATEGORIES[activeTab].label}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {filteredPositions.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Ativo</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">
                    Preço Atual
                  </th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">
                    Total
                  </th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">
                    % Categoria
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPositions.map((row) => {
                  const share = totalValue > 0 ? (row.total_value / totalValue) * 100 : 0;
                  return (
                    <tr
                      key={row.ticker}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex flex-col">
                          <span>{row.ticker}</span>
                          <span className="text-xs text-gray-500 font-normal">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{row.qty}</td>
                      <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300">
                        R$ {row.price_close.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">
                        R$ {row.total_value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Você não possui ativos nesta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WalletDashboard;
