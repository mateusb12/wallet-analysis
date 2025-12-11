import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { TrendingUp, Calendar, DollarSign, Tag, Search, Filter } from 'lucide-react';

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
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();

        const sorted = data.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
        setPurchases(sorted);
      }
    } catch (error) {
      console.error('Erro ao buscar aportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((item) => {
    const matchesSearch =
      item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20">
      {}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-600" />
            Meus Aportes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Histórico completo de negociações e movimentações
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

      {}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando histórico...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Ativo</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Nome</th>
                  <th className="px-6 py-3 font-medium text-center">Tipo</th>
                  <th className="px-6 py-3 font-medium text-right">Qtd</th>
                  <th className="px-6 py-3 font-medium text-right">Preço Unit.</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {new Date(item.trade_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        {item.ticker}
                      </td>
                      <td
                        className="px-6 py-4 hidden md:table-cell text-gray-500 dark:text-gray-400 truncate max-w-[200px]"
                        title={item.name}
                      >
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(item.type)}`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                        {item.qty}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                        {Number(item.price).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                        {(Number(item.price) * Number(item.qty)).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
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
