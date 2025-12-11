import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Landmark,
  LineChart,
} from 'lucide-react';
import { syncService } from '../services/api.js';
import { syncIpcaHistory } from '../services/ipcaService.js';
import { cdiService } from '../services/cdiService.js';

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

  const handleIbovSync = async () => {
    executeSync(() => syncService.syncIbov());
  };

  const handleIfixSync = async () => {
    const tickerToUse = ticker || '^IFIX';
    executeSync(() => syncService.syncIfix(tickerToUse));
  };

  const handleIpcaSync = async () => {
    executeSync(async () => {
      const result = await syncIpcaHistory();
      if (result && (result.inserted >= 0 || result.message)) {
        return {
          success: true,
          count: result.inserted,
          message: result.message || `${result.inserted} meses do IPCA sincronizados.`,
        };
      }
      return { success: false, error: 'Falha ao sincronizar IPCA' };
    });
  };

  const handleCdiSync = async () => {
    executeSync(() => cdiService.syncCdi());
  };

  const executeSync = async (syncFunction) => {
    setLoading(true);
    setStatus(null);
    setMsg('');

    try {
      const result = await syncFunction();

      if (result.success) {
        setStatus('success');
        const countMsg = result.count !== undefined ? `${result.count} registros` : 'Dados';
        setMsg(result.message || `Sucesso! ${countMsg} atualizados.`);
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
          Sincronização Manual
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Atualiza cotações via Yahoo Finance (Proxy) e índices oficiais (BCB/B3).
        </p>
      </div>

      <div className="p-6">
        <div className="flex flex-col gap-4">
          {}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ticker (ex: BTLG11)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="DIGITE..."
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
                <button
                  onClick={handleSync}
                  disabled={loading || !ticker}
                  className={`px-6 py-2 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${
                    loading || !ticker
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading && ticker ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Sync Ativo'
                  )}
                </button>
              </div>
            </div>
          </div>

          {}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              Índices de Mercado
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {}
              <button
                onClick={handleIbovSync}
                disabled={loading}
                className="px-3 py-2.5 rounded-lg font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading && !ticker ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LineChart className="w-4 h-4" />
                )}
                Sync IBOV
              </button>

              {}
              <button
                onClick={handleIfixSync}
                disabled={loading}
                className="px-3 py-2.5 rounded-lg font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading && !ticker ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Sync IFIX
              </button>

              {}
              <button
                onClick={handleIpcaSync}
                disabled={loading}
                className="px-3 py-2.5 rounded-lg font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading && !ticker ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Sync IPCA
              </button>

              {}
              <button
                onClick={handleCdiSync}
                disabled={loading}
                className="px-3 py-2.5 rounded-lg font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading && !ticker ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Landmark className="w-4 h-4" />
                )}
                Sync CDI
              </button>
            </div>
          </div>
        </div>

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
