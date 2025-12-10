import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '../features/theme/ThemeContext';
import { useAuth } from '../features/auth/AuthContext';

import { useDataConsistency } from '../hooks/useDataConsistency';
import DataConsistencyAlert from '../components/DataConsistencyAlert';
import ManualPriceSync from '../components/ManualPriceSync.jsx';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const { warnings } = useDataConsistency();

  const [notifications, setNotifications] = useState({
    email: true,
    browser: false,
    offers: false,
  });
  const [apiKey, setApiKey] = useState('hg_29384...8s7d');

  const [importPreview, setImportPreview] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  const userEmail = user?.email || 'usuario@exemplo.com';
  const userName = userEmail.split('@')[0];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const wsname = workbook.SheetNames[0];
      const ws = workbook.Sheets[wsname];

      const data = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true });

      const formattedData = data
        .map((row) => {
          let rawProduct = row['Produto'] || row['produto'] || '';
          let ticker = 'UNKNOWN';
          let name = 'N/A';

          if (rawProduct) {
            const parts = rawProduct.split(' - ');
            ticker = parts[0].trim();
            name = parts.length > 1 ? parts.slice(1).join(' - ').trim() : ticker;
          }

          let rawPrice = row['Preço unitário'] || row['Preço Médio'] || row['Valor'] || 0;
          let price = rawPrice;
          if (typeof rawPrice === 'string') {
            price =
              parseFloat(rawPrice.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) ||
              0;
          }

          let rawDate = row['Data'] || row['data'];
          let purchaseDate = '';

          if (rawDate instanceof Date) {
            purchaseDate = rawDate.toLocaleDateString('pt-BR');
          } else if (rawDate) {
            purchaseDate = String(rawDate).trim();
          }

          let type = 'stock';
          if (ticker.endsWith('11')) type = 'fii';
          if (ticker.endsWith('34')) type = 'bdr';

          return {
            ticker,
            name,
            qty: Number(row['Quantidade'] || row['quantidade'] || 0),
            type,
            price,
            date: purchaseDate,
          };
        })
        .filter((item) => item.ticker !== 'UNKNOWN' && item.ticker !== '');

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

  const handleConfirmImport = () => {
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      alert(`${importPreview.length} itens importados com sucesso!`);
      handleClearImport();
    }, 1500);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-indigo-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              Importador de Ativos
            </h3>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Selecione um arquivo Excel (.xlsx) para carregar sua carteira.
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-8 h-8 text-green-500 mb-2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {fileName}
                      </p>
                      <p className="text-xs text-green-500/80 mt-1">
                        Clique para alterar o arquivo
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-8 h-8 mb-3 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        ></path>
                      </svg>
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Clique para enviar</span> ou arraste
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        XLSX ou XLS (MAX. 5MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls"
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
                      Pré-visualização da Importação
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200">
                      {importPreview.length} itens encontrados
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 text-indigo-500 transition-transform duration-200 ${isPreviewOpen ? 'rotate-180' : ''}`}
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
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
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
                          {importPreview.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-2 text-gray-900 dark:text-white">
                                {row.date}
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
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={handleClearImport}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white transition-all
                          ${isProcessing ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                        `}
                      >
                        {isProcessing ? 'Salvando...' : 'Confirmar Importação'}
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
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
                  className={`w-2.5 h-2.5 rounded-full ${warnings.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                ></span>
                <span
                  className={`text-sm font-medium ${warnings.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
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
