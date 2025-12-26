import React, { useState } from 'react';
import { Trash2, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatChartDate } from '../../utils/dateUtils';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';

export default function ContributionsManager({ purchases, onRefresh, userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const filteredPurchases = purchases
    .filter((p) => p.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));

  const getTypeConfig = (type) => {
    const t = type?.toLowerCase() || '';

    switch (t) {
      case 'stock':
      case 'ação':
        return {
          icon: iconStocks,
          label: 'AÇÃO',
          style:
            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        };
      case 'fii':
        return {
          icon: iconFiis,
          label: 'FII',
          style:
            'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        };
      case 'etf':
        return {
          icon: iconEtf,
          label: 'ETF',
          style:
            'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        };
      case 'bdr':
        return {
          icon: iconStocks,
          label: 'BDR',
          style:
            'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
        };
      default:
        return {
          icon: iconTotal,
          label: type?.toUpperCase() || 'OUTRO',
          style:
            'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
        };
    }
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditForm({
      date: item.trade_date ? item.trade_date.split('T')[0] : '',
      price: item.price,
      qty: item.qty,
      type: item.type,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id) => {
    try {
      const response = await fetch(`${API_URL}/wallet/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          trade_date: editForm.date,
          price: Number(editForm.price),
          qty: Number(editForm.qty),
          type: editForm.type,
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar');

      await onRefresh();
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar alterações.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este aporte permanentemente?')) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`${API_URL}/wallet/purchases/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir');

      await onRefresh();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir aporte.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
      {}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
            <Edit2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gerenciar Aportes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOpen
                ? 'Modo de edição habilitado.'
                : 'Clique para expandir, editar ou excluir lançamentos.'}
            </p>
          </div>
        </div>

        <button className="p-2 text-gray-400 group-hover:text-orange-500 transition-colors">
          {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
      </div>

      {}
      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-200 bg-gray-50/50 dark:bg-gray-900/10">
          {}
          <div className="p-4 px-6 border-b border-gray-100 dark:border-gray-700">
            <input
              type="text"
              placeholder="🔍 Buscar por ticker (ex: BBAS3)..."
              className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-center tracking-wider">Data</th>
                  <th className="px-6 py-3 text-center tracking-wider">Ativo</th>
                  <th className="px-6 py-3 text-center tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-center tracking-wider">Qtd</th>
                  <th className="px-6 py-3 text-center tracking-wider">Preço</th>
                  <th className="px-6 py-3 text-center tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((item) => {
                    const isEditing = editingId === item.id;
                    const typeConfig = getTypeConfig(item.type);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                      >
                        {}
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full"
                            />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300 font-mono text-xs font-medium">
                              {formatChartDate(item.trade_date)}
                            </span>
                          )}
                        </td>

                        {}
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs tracking-wide">
                            {item.ticker}
                          </span>
                        </td>

                        {}
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full"
                            >
                              <option value="stock">Ação</option>
                              <option value="fii">FII</option>
                              <option value="etf">ETF</option>
                              <option value="bdr">BDR</option>
                            </select>
                          ) : (
                            <div
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${typeConfig.style}`}
                            >
                              <img
                                src={typeConfig.icon}
                                alt={typeConfig.label}
                                className="w-4 h-4 object-contain drop-shadow-sm"
                              />
                              <span className="text-[10px] font-bold tracking-wider">
                                {typeConfig.label}
                              </span>
                            </div>
                          )}
                        </td>

                        {}
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.qty}
                              onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
                              className="w-20 text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-white font-medium">
                              {item.qty}
                            </span>
                          )}
                        </td>

                        {}
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-gray-400 text-xs">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editForm.price}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, price: e.target.value })
                                }
                                className="w-24 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {Number(item.price).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </td>

                        {}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSave(item.id)}
                                  className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors shadow-sm"
                                  title="Salvar"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="p-1.5 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditClick(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  disabled={isDeleting === item.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                  title="Excluir"
                                >
                                  {isDeleting === item.id ? (
                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-400 dark:text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <img
                          src={iconTotal}
                          className="w-10 h-10 opacity-30 grayscale mb-2"
                          alt="Nada encontrado"
                        />
                        <span>Nenhum aporte encontrado.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
