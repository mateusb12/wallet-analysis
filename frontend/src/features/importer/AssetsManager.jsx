import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  Trash2,
  Edit2,
  Save,
  FileSpreadsheet,
  AlertCircle,
  Bug,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';

import iconStocks from '../../assets/stocks.png';
import iconEtf from '../../assets/etf.png';
import iconFiis from '../../assets/fiis.png';
import iconTotal from '../../assets/all.png';
import { formatChartDate } from '../../utils/dateUtils.js';

import shotA from '../../assets/screenshots/A.jpeg';
import shotB from '../../assets/screenshots/B.jpeg';
import shotC from '../../assets/screenshots/C.jpeg';
import shotD from '../../assets/screenshots/D.jpeg';

export default function AssetsManager() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isDeleting, setIsDeleting] = useState(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  const [debugShowEmpty, setDebugShowEmpty] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (user?.id) fetchPurchases();
  }, [user]);

  const toStandardDate = (dateInput) => {
    if (!dateInput) return '';
    if (
      typeof dateInput === 'object' ||
      (typeof dateInput === 'string' && dateInput.includes('T'))
    ) {
      const d = new Date(dateInput);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    }
    if (typeof dateInput === 'string' && dateInput.includes('/')) {
      const parts = dateInput.split('/');
      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateInput;
    }
    return dateInput;
  };

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

  const getDuplicateStatus = (row) => {
    if (!purchases.length) return 'new';

    const rowDateString = toStandardDate(row.date);
    const rowTicker = row.ticker.trim().toUpperCase();

    const match = purchases.find((dbItem) => {
      const dbTicker = dbItem.ticker.trim().toUpperCase();
      if (dbTicker !== rowTicker) return false;

      const sameQty = Number(dbItem.qty) === Number(row.qty);
      if (!sameQty) return false;

      const samePrice = Math.abs(Number(dbItem.price) - Number(row.price)) < 0.05;
      if (!samePrice) return false;

      const dbDateString = toStandardDate(dbItem.trade_date);
      if (dbDateString === rowDateString) return true;

      const d1 = new Date(dbDateString);
      const d2 = new Date(rowDateString);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays <= 6;
    });

    if (match) return 'duplicate';
    const tickerExists = purchases.some(
      (dbItem) => dbItem.ticker.trim().toUpperCase() === rowTicker
    );
    if (tickerExists) return 'exists';
    return 'new';
  };

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setPurchases(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
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

  const handleSaveEdit = async (id) => {
    try {
      const response = await fetch(`${API_URL}/wallet/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          trade_date: editForm.date,
          price: Number(editForm.price),
          qty: Number(editForm.qty),
          type: editForm.type,
        }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar');
      await fetchPurchases();
      setEditingId(null);
    } catch (error) {
      alert('Erro ao salvar alterações.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este aporte permanentemente?')) return;
    setIsDeleting(id);
    try {
      await fetch(`${API_URL}/wallet/purchases/${id}`, { method: 'DELETE' });
      await fetchPurchases();
    } catch (error) {
      alert('Erro ao excluir.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    let fileDate = new Date().toLocaleDateString('pt-BR');
    const dateMatch = file.name.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      fileDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      let allData = [];

      workbook.SheetNames.forEach((sheetName) => {
        const ws = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true });

        const taggedData = sheetData.map((row) => {
          if (row['Data do Negócio'] !== undefined) return { ...row, _source: 'NEGOCIACAO' };
          if (row['Movimentação'] !== undefined) return { ...row, _source: 'MOVIMENTACAO' };
          return { ...row, _source: 'POSICAO' };
        });
        allData = [...allData, ...taggedData];
      });

      const formattedData = allData
        .map((row) => {
          let ticker = 'UNKNOWN';
          let name = 'N/A';
          let price = 0;
          let qty = 0;
          let purchaseDate = fileDate;
          let type = 'stock';

          if (row._source === 'NEGOCIACAO') {
            let rawTicker = row['Código de Negociação'] || '';
            if (rawTicker.endsWith('F')) rawTicker = rawTicker.slice(0, -1);
            ticker = rawTicker.trim();
            name = row['Instituição'] || ticker;
            qty = Number(row['Quantidade'] || 0);
            price = Number(row['Preço'] || 0);
            let rawDate = row['Data do Negócio'];
            if (rawDate instanceof Date) purchaseDate = rawDate.toLocaleDateString('pt-BR');
            else if (rawDate) purchaseDate = String(rawDate).trim();
          } else if (row._source === 'MOVIMENTACAO') {
            const movType = row['Movimentação'] || '';
            if (!movType.includes('Liquidação') && !movType.includes('Compra')) return null;
            let rawProduct = row['Produto'] || '';
            if (rawProduct) {
              const parts = rawProduct.split(' - ');
              ticker = parts[0].trim();
              name = parts.length > 1 ? parts.slice(1).join(' - ').trim() : ticker;
            }
            qty = Number(row['Quantidade'] || 0);
            price = Number(row['Preço unitário'] || 0);
            let rawDate = row['Data'];
            if (rawDate instanceof Date) purchaseDate = rawDate.toLocaleDateString('pt-BR');
            else if (rawDate) purchaseDate = String(rawDate).trim();
          } else {
            let rawProduct = row['Produto'] || row['produto'] || '';
            if (rawProduct) {
              const parts = rawProduct.split(' - ');
              ticker = parts[0].trim();
              name = parts.length > 1 ? parts.slice(1).join(' - ').trim() : ticker;
            }
            qty = Number(row['Quantidade'] || row['quantidade'] || 0);
            let rawPrice = row['Preço de Fechamento'] || row['Preço unitário'] || row['Valor'] || 0;
            if (typeof rawPrice === 'string') {
              price =
                parseFloat(
                  rawPrice.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
                ) || 0;
            } else {
              price = rawPrice;
            }
            if (price === 0 && qty > 0) {
              const totalValRaw = row['Valor Atualizado'] || 0;
              let totalVal =
                typeof totalValRaw === 'string'
                  ? parseFloat(
                      totalValRaw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
                    )
                  : totalValRaw;
              if (totalVal > 0) price = totalVal / qty;
            }
          }

          if (ticker.endsWith('11')) type = 'fii';
          if (ticker.endsWith('33') || ticker.endsWith('34')) type = 'bdr';
          if (['IVVB11', 'BOVA11', 'SMAL11', 'QQQQ11', 'XINA11', 'HASH11'].includes(ticker))
            type = 'etf';
          if (ticker === 'UNKNOWN' || ticker === '' || qty === 0) return null;

          return { ticker, name, qty, type, price, date: purchaseDate };
        })
        .filter((item) => item !== null);

      setImportPreview(formattedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleClearImport = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setImportPreview([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloseModal = () => {
    setIsImportModalOpen(false);
    handleClearImport();
  };

  const handleConfirmImport = async () => {
    if (!user || !user.id) return;

    const newItems = importPreview.filter((row) => {
      const status = getDuplicateStatus(row);
      return status !== 'duplicate' && status !== 'potential';
    });

    if (newItems.length === 0) return;

    setIsProcessingImport(true);
    try {
      const payload = {
        user_id: user.id,
        purchases: newItems.map((item) => ({
          ticker: item.ticker,
          name: item.name,
          type: item.type,
          qty: item.qty,
          price: item.price,
          trade_date: toStandardDate(item.date),
        })),
      };

      const response = await fetch(`${API_URL}/wallet/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Falha na importação');

      alert(`Sucesso! ${data.count} novos ativos salvos.`);

      await fetchPurchases();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const newItemsCount = importPreview.filter((r) => {
    const s = getDuplicateStatus(r);
    return s !== 'duplicate' && s !== 'potential';
  }).length;

  const duplicateCount = importPreview.length - newItemsCount;

  const filteredPurchases = purchases
    .filter((p) => p.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));

  const showEmptyState = (purchases.length === 0 && !isLoading) || debugShowEmpty;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300">
      {}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Gerenciar Aportes
            {!showEmptyState && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                {purchases.length} registros
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visualize e edite seu histórico ou importe novos dados.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {}
          {import.meta.env.DEV && (
            <button
              onClick={() => setDebugShowEmpty(!debugShowEmpty)}
              className={`p-2 rounded-lg transition-all border ${
                debugShowEmpty
                  ? 'bg-orange-100 text-orange-600 border-orange-200'
                  : 'bg-gray-100 text-gray-400 border-gray-200 hover:text-orange-500'
              }`}
              title="Simular conta vazia (Debug - Dev Only)"
            >
              <Bug size={18} />
            </button>
          )}

          {!showEmptyState && (
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar ticker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48"
              />
            </div>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4" />
            Importar B3
          </button>
        </div>
      </div>

      {}
      {showEmptyState ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col items-center animate-in fade-in duration-300">
          <div className="text-center max-w-lg mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Você ainda não possui ativos
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Para começar a acompanhar sua rentabilidade, importe seus dados diretamente da Área do
              Investidor da B3. É simples e rápido.
            </p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105"
            >
              <UploadCloud className="w-5 h-5" />
              Realizar Primeira Importação
            </button>
          </div>

          <div className="w-full max-w-6xl border-t border-gray-200 dark:border-gray-700 pt-8">
            <h3 className="text-center text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6 flex items-center justify-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Passo a Passo da Importação
              <ArrowRight className="w-4 h-4" />
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { img: shotA, label: '1. Acesse Extratos' },
                { img: shotB, label: '2. Clique nesse botão amarelo' },
                { img: shotC, label: '3. Selecione 12 Meses' },
                { img: shotD, label: '4. Baixe o Excel' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg z-10 shadow-sm">
                    {item.label}
                  </div>
                  <img
                    src={item.img}
                    alt={`Passo ${idx + 1}`}
                    className="w-full aspect-[4/3] object-contain bg-gray-50 dark:bg-gray-900 group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-center tracking-wider">Data</th>
                  <th className="px-6 py-3 text-center tracking-wider">Ativo</th>
                  <th className="px-6 py-3 text-center tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-center tracking-wider">Qtd</th>
                  <th className="px-6 py-3 text-center tracking-wider">Preço</th>
                  <th className="px-6 py-3 text-center tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-gray-400">
                      Nenhum resultado para a busca.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((item) => {
                    const isEditing = editingId === item.id;
                    const typeConfig = getTypeConfig(item.type);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="bg-white dark:bg-gray-900 border rounded px-2 py-1 text-gray-900 dark:text-white"
                            />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300 font-mono text-xs font-medium">
                              {formatChartDate(item.trade_date)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-800 dark:text-gray-100">
                          {item.ticker}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              className="bg-white dark:bg-gray-900 border rounded px-2 py-1 text-gray-900 dark:text-white"
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
                        <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white">
                          {item.qty}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-600 dark:text-gray-300">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.price}
                              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                              className="w-24 bg-white dark:bg-gray-900 border rounded px-2 py-1 text-gray-900 dark:text-white"
                            />
                          ) : (
                            Number(item.price).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2 opacity-80 hover:opacity-100">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(item.id)}
                                  className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 bg-gray-50 text-gray-500 rounded hover:bg-gray-100"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditClick(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {}
        </>
      )}

      {}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-green-600 w-6 h-6" />
                  Importar Arquivo B3
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Arraste seu arquivo Excel para verificar duplicatas.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-gray-800">
              {}
              <label
                className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group
                        ${
                          fileName
                            ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
              >
                <div className="flex flex-col items-center justify-center p-4">
                  {fileName ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2 drop-shadow-sm" />
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        {fileName}
                      </p>
                      <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-1">
                        Arquivo carregado com sucesso
                      </p>

                      {}
                      <button
                        onClick={handleClearImport}
                        className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                        Clique para enviar ou arraste o arquivo aqui
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Suporta .XLSX e .CSV</p>
                    </>
                  )}
                </div>
                {!fileName && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                  />
                )}
              </label>

              {}
              {importPreview.length > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      Pré-visualização dos Dados
                    </h4>
                    <div className="flex gap-2">
                      <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                        {newItemsCount} Novos
                      </span>
                      {duplicateCount > 0 && (
                        <span className="text-xs font-medium bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {duplicateCount} duplicados
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-900 sticky top-0 text-gray-500 dark:text-gray-400 z-10">
                          <tr>
                            <th className="px-4 py-3 font-medium">Data</th>
                            <th className="px-4 py-3 font-medium">Ticker</th>
                            <th className="px-4 py-3 font-medium">Nome</th>
                            <th className="px-4 py-3 font-medium text-right">Qtd</th>
                            <th className="px-4 py-3 font-medium text-right">Preço</th>
                            <th className="px-4 py-3 font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {importPreview.map((row, idx) => {
                            const status = getDuplicateStatus(row);
                            const isDup = status === 'duplicate';

                            const rowClass = isDup
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 text-gray-600 dark:text-gray-400'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-blue-50/50 dark:hover:bg-blue-900/10';

                            return (
                              <tr key={idx} className={`transition-colors ${rowClass}`}>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {formatChartDate(row.date)}
                                </td>
                                <td className="px-4 py-2.5 font-bold">{row.ticker}</td>
                                <td className="px-4 py-2.5 truncate max-w-[180px] text-xs">
                                  {row.name}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono">{row.qty}</td>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  {Number(row.price).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {isDup ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                                      JÁ EXISTE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                      NOVO
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 items-center">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={isProcessingImport || newItemsCount === 0}
                className={`px-6 py-2 rounded-lg font-medium text-white shadow-sm flex items-center gap-2 transition-all
                            ${
                              isProcessingImport || newItemsCount === 0
                                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                                : 'bg-green-600 hover:bg-green-700 hover:shadow-md'
                            }`}
              >
                {isProcessingImport ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {newItemsCount === 0
                      ? 'Sem novos registros'
                      : `Importar ${newItemsCount} Registros`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
