import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { syncService } from '../services/api.js';

export default function ManualPriceSync() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');

  const handleSync = async (e) => {
    e.preventDefault();
    if (!ticker) return;
    executeSync(() => syncService.syncTicker(ticker));
  };

  const handleIfixSync = async () => {
    const tickerToUse = ticker || 'XFIX11';
    executeSync(() => syncService.syncIfix(tickerToUse));
  };

  const executeSync = async (syncFunction) => {
    setLoading(true);
    setStatus(null);
    setMsg('');

    try {
      const result = await syncFunction();

      if (result.success) {
        setStatus('success');
        setMsg(`Sucesso! ${result.count} registros atualizados.`);
        setTicker('');
      } else {
        throw new Error(result.error || 'Erro desconhecido.');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setStatus('error');
      setMsg(error.message || 'Erro crítico na execução.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          Sincronização Manual (Proxy JS)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Atualiza cotações recentes do Yahoo Finance. Use <b>XFIX11</b> para IFIX.
        </p>
      </div>

      <div className="p-6">
        <form onSubmit={handleSync} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ticker (ex: BTLG11 ou XFIX11)
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Digite o ativo..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="submit"
              disabled={loading || !ticker}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                loading || !ticker
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sincronizar Ativo'}
            </button>

            <button
              type="button"
              onClick={handleIfixSync}
              disabled={loading}
              title="Sincronizar tabela IFIX usando XFIX11 ou ticker atual"
              className="px-4 py-2 rounded-lg font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Sync IFIX</span>
            </button>
          </div>
        </form>

        {status === 'success' && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4" />
            {msg}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 text-sm break-all">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
