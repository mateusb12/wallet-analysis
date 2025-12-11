import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '../features/theme/ThemeContext';
import { useAuth } from '../features/auth/AuthContext';
import { useDataConsistency } from '../hooks/useDataConsistency';
import DataConsistencyAlert from '../components/DataConsistencyAlert';
import ManualPriceSync from '../components/ManualPriceSync.jsx';
import {
  AlertTriangle,
  CheckCircle,
  Database,
  UploadCloud,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const { warnings } = useDataConsistency();

  const [apiKey, setApiKey] = useState('hg_29384...8s7d');

  const [importPreview, setImportPreview] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  const [existingPurchases, setExistingPurchases] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const userEmail = user?.email || 'usuario@exemplo.com';
  const userName = userEmail.split('@')[0];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (user?.id) {
      fetchExistingPurchases();
    }
  }, [user]);

  const fetchExistingPurchases = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setExistingPurchases(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toStandardDate = (dateInput) => {
    if (!dateInput) return '';

    if (
      typeof dateInput === 'object' ||
      (typeof dateInput === 'string' && dateInput.includes('T'))
    ) {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    }

    if (typeof dateInput === 'string' && dateInput.includes('/')) {
      const parts = dateInput.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateInput;
    }

    return dateInput;
  };

  const getDuplicateStatus = (row) => {
    if (!existingPurchases.length) return 'new';

    const rowDateString = toStandardDate(row.date);
    const rowTicker = row.ticker.trim().toUpperCase();

    const match = existingPurchases.find((dbItem) => {
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

    const tickerExists = existingPurchases.some(
      (dbItem) => dbItem.ticker.trim().toUpperCase() === rowTicker
    );

    if (tickerExists) return 'exists';

    return 'new';
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
            if (!movType.includes('Liquidação') && !movType.includes('Compra')) {
              return null;
            }

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
          if (['IVVB11', 'BOVA11', 'SMAL11', 'QQQQ11', 'XINA11', 'HASH11'].includes(ticker)) {
            type = 'etf';
          }

          if (ticker === 'UNKNOWN' || ticker === '' || qty === 0) return null;

          return {
            ticker,
            name,
            qty,
            type,
            price,
            date: purchaseDate,
          };
        })
        .filter((item) => item !== null);

      setImportPreview(formattedData);
      setIsPreviewOpen(true);
    };
    reader.readAsBinaryString(file);
  };

  const handleClearImport = () => {
    setImportPreview([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!user || !user.id) {
      alert('Erro: Usuário não autenticado.');
      return;
    }

    const newItems = importPreview.filter((row) => {
      const status = getDuplicateStatus(row);
      return status !== 'duplicate' && status !== 'potential';
    });

    if (newItems.length === 0) {
      alert('Todos os itens já foram importados ou são duplicatas.');
      return;
    }

    setIsProcessing(true);

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || 'Falha na importação');

      const skippedCount = importPreview.length - newItems.length;
      alert(`Sucesso! ${data.count} novos ativos salvos. (${skippedCount} duplicados ignorados)`);

      await fetchExistingPurchases();
      handleClearImport();
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const newItemsCount = importPreview.filter((r) => {
    const s = getDuplicateStatus(r);
    return s !== 'duplicate' && s !== 'potential';
  }).length;

  const duplicateCount = importPreview.length - newItemsCount;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
      {}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Configurações</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <DataConsistencyAlert warnings={warnings} className="mb-8" />

      <div className="space-y-6">
        <ManualPriceSync />

        {}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              Perfil
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Alterar Avatar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  defaultValue={userName}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={userEmail}
                  disabled
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </section>

        {}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-500" />
              Importador de Ativos
            </h3>
            {isLoadingHistory && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Verificando histórico...
              </span>
            )}
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Suporta arquivos B3: <strong>Posição (Custódia)</strong>,{' '}
              <strong>Negociação (Histórico)</strong> e <strong>Movimentação</strong>.
            </p>

            <div className="mb-6">
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 
                  ${
                    fileName
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-500/50'
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600'
                  }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {fileName ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {fileName}
                      </p>
                      <p className="text-xs text-green-500/80 mt-1">
                        Clique para alterar o arquivo
                      </p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Clique para enviar</span> ou arraste
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        XLSX, XLS ou CSV (MAX. 5MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                />
              </label>
            </div>

            {}
            {importPreview.length > 0 && (
              <div className="border border-indigo-100 dark:border-indigo-900/50 rounded-lg overflow-hidden transition-all duration-300">
                <button
                  onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                  className="w-full flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">
                      Pré-visualização
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200">
                      {importPreview.length} itens encontrados
                    </span>
                    {duplicateCount > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {duplicateCount} Duplicados
                      </span>
                    )}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 text-indigo-500 transition-transform duration-200 ${
                      isPreviewOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>

                {isPreviewOpen && (
                  <div className="bg-white dark:bg-gray-800 border-t border-indigo-100 dark:border-indigo-900/50">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-2">Data</th>
                            <th className="px-4 py-2">Ticker</th>
                            <th className="px-4 py-2">Nome</th>
                            <th className="px-4 py-2 text-right">Qtd</th>
                            <th className="px-4 py-2 text-right">Preço</th>
                            <th className="px-4 py-2 text-right">Tipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {importPreview.map((row, index) => {
                            const status = getDuplicateStatus(row);
                            let rowClass = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
                            let badge = null;

                            if (status === 'duplicate') {
                              rowClass = 'bg-red-50 dark:bg-red-900/20';
                              badge = (
                                <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1 rounded mt-0.5 w-max">
                                  DUPLICADO
                                </span>
                              );
                            } else if (status === 'potential') {
                              rowClass = 'bg-yellow-50 dark:bg-yellow-900/20';
                              badge = (
                                <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded mt-0.5 w-max">
                                  VERIFICAR
                                </span>
                              );
                            } else if (status === 'exists') {
                              rowClass = 'bg-blue-50 dark:bg-blue-900/10';
                              badge = (
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1 rounded mt-0.5 w-max">
                                  NOVO APORTE
                                </span>
                              );
                            }

                            return (
                              <tr key={index} className={`transition-colors ${rowClass}`}>
                                <td className="px-4 py-2 text-gray-900 dark:text-white flex flex-col justify-center">
                                  <span>{row.date}</span>
                                  {badge}
                                </td>
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                  {row.ticker}
                                </td>
                                <td
                                  className="px-4 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[150px]"
                                  title={row.name}
                                >
                                  {row.name}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                                  {row.qty}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                                  {Number(row.price).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </td>
                                <td className="px-4 py-2 text-right text-xs uppercase text-gray-500 dark:text-gray-400">
                                  {row.type}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 items-center">
                      <button
                        onClick={handleClearImport}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>

                      <button
                        onClick={handleConfirmImport}
                        disabled={isProcessing || newItemsCount === 0}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white transition-all
                          ${
                            isProcessing || newItemsCount === 0
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg'
                          }
                        `}
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                          </>
                        ) : newItemsCount === 0 ? (
                          'Nada para importar'
                        ) : duplicateCount > 0 ? (
                          `Importar ${newItemsCount} Novos (Ignorar ${duplicateCount})`
                        ) : (
                          'Confirmar Importação'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-purple-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.048 4.088a5.999 5.999 0 01-1.428-14.832 3 3 0 0110.876 0 5.999 5.999 0 011.43 14.832"
                />
              </svg>
              Aparência
            </h3>
          </div>
          <div className="p-6 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Tema do Sistema</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alternar entre modo claro e escuro
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>

        {}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-green-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
                />
              </svg>
              Integridade de Dados & API
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Status da Sincronização
                </p>
                <p className="text-xs text-gray-500">Verificação automática de datas</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    warnings.length > 0 ? 'bg-red-500' : 'bg-green-500'
                  }`}
                ></span>
                <span
                  className={`text-sm font-medium ${
                    warnings.length > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {warnings.length > 0 ? 'Atenção Requerida' : 'Sistemas Operacionais'}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chave HG Brasil (Opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button className="px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
                  Testar
                </button>
              </div>
            </div>
          </div>
        </section>

        {}
        <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              Zona de Perigo
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Deletar Conta</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Esta ação é permanente.</p>
              </div>
              <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm">
                Deletar Conta
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
