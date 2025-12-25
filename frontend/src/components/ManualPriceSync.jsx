import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Landmark,
  LineChart,
  Layers,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { syncService } from '../services/api.js';
import { syncIpcaHistory } from '../services/ipcaService.js';
import { cdiService } from '../services/cdiService.js';
import { fetchWalletPositions } from '../services/walletDataService.js';

export default function ManualPriceSync() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');

  const [syncReport, setSyncReport] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);

  const resetStates = () => {
    setStatus(null);
    setMsg('');
    setSyncReport(null);
  };

  const executeSync = async (syncFunction) => {
    setLoading(true);
    resetStates();

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

  const handleSync = async (e) => {
    e.preventDefault();
    if (!ticker) return;
    executeSync(() => syncService.syncTicker(ticker));
  };

  const handleSyncAll = async () => {
    setLoading(true);
    resetStates();
    setBatchProgress({ current: 0, total: 0, ticker: 'Verificando carteira...' });

    try {
      const positions = await fetchWalletPositions(true);

      const today = new Date().toISOString().split('T')[0];
      const uniqueTickers = [
        ...new Set(
          positions
            .filter((p) => !p.last_update || p.last_update.split('T')[0] !== today)
            .map((p) => p.ticker)
        ),
      ];

      const indicesToSync = [
        { id: 'IBOV', label: 'Índice IBOVESPA', action: () => syncService.syncIbov() },
        { id: 'IFIX', label: 'Índice IFIX', action: () => syncService.syncIfix('^IFIX') },
        { id: 'CDI', label: 'Taxa CDI', action: () => cdiService.syncCdi() },
        {
          id: 'IPCA',
          label: 'Inflação IPCA',
          action: async () => {
            const res = await syncIpcaHistory();
            if (res && (res.inserted >= 0 || res.message)) return res;
            throw new Error('Falha na resposta do IPCA');
          },
        },
      ];

      const totalTasks = uniqueTickers.length + indicesToSync.length;

      if (totalTasks === 0) {
        setLoading(false);
        setStatus('success');
        setMsg('Tudo já está atualizado. Nenhuma ação necessária.');
        setBatchProgress(null);
        return;
      }

      setBatchProgress({ current: 0, total: totalTasks, ticker: '' });

      let successCount = 0;
      let errorDetails = [];
      let currentStep = 0;

      for (const currentTicker of uniqueTickers) {
        currentStep++;
        setBatchProgress({
          current: currentStep,
          total: totalTasks,
          ticker: currentTicker,
        });

        try {
          await syncService.syncTicker(currentTicker);
          successCount++;
        } catch (err) {
          console.error(`Falha ao atualizar ${currentTicker}`, err);
          errorDetails.push(`${currentTicker}: ${err.message || 'Erro desconhecido'}`);
        }
      }

      for (const indexObj of indicesToSync) {
        currentStep++;
        setBatchProgress({
          current: currentStep,
          total: totalTasks,
          ticker: indexObj.label,
        });

        try {
          await indexObj.action();
          successCount++;
        } catch (err) {
          console.error(`Falha ao atualizar ${indexObj.id}`, err);
          errorDetails.push(`${indexObj.id}: ${err.message || 'Erro desconhecido'}`);
        }
      }

      setSyncReport({
        success: successCount,
        errorCount: errorDetails.length,
        errors: errorDetails,
      });
    } catch (error) {
      setStatus('error');
      setMsg(error.message || 'Erro ao iniciar sincronização em lote.');
    } finally {
      setLoading(false);
      setBatchProgress(null);
    }
  };

  const handleIbovSync = () => executeSync(() => syncService.syncIbov());
  const handleIfixSync = () => executeSync(() => syncService.syncIfix(ticker || '^IFIX'));
  const handleCdiSync = () => executeSync(() => cdiService.syncCdi());

  const handleIpcaSync = () => {
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Sincronização Manual
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Atualiza cotações via Yahoo Finance (Proxy) e índices oficiais (BCB/B3).
          </p>
        </div>

        {!batchProgress && (
          <button
            onClick={handleSyncAll}
            disabled={loading}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            Sincronizar Carteira Completa
          </button>
        )}
      </div>

      <div className="p-6">
        {}
        {batchProgress && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 animate-pulse">
            <div className="flex justify-between text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">
              <span>Atualizando preços...</span>
              <span>
                {batchProgress.current} / {batchProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400">
              Processando: <span className="font-bold">{batchProgress.ticker}</span>
            </p>
          </div>
        )}

        {}
        {!batchProgress && (
          <button
            onClick={handleSyncAll}
            disabled={loading}
            className="sm:hidden w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            Sincronizar Carteira Completa
          </button>
        )}

        {}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ticker Individual (ex: BTLG11)
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
                      : 'bg-gray-600 hover:bg-gray-700'
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

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              Índices de Mercado
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={handleIbovSync}
                disabled={loading}
                className="idx-btn bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
              >
                <LineChart className="w-4 h-4" /> Sync IBOV
              </button>
              <button
                onClick={handleIfixSync}
                disabled={loading}
                className="idx-btn bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
              >
                <TrendingUp className="w-4 h-4" /> Sync IFIX
              </button>
              <button
                onClick={handleIpcaSync}
                disabled={loading}
                className="idx-btn bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
              >
                <BarChart3 className="w-4 h-4" /> Sync IPCA
              </button>
              <button
                onClick={handleCdiSync}
                disabled={loading}
                className="idx-btn bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Landmark className="w-4 h-4" /> Sync CDI
              </button>
            </div>
          </div>
        </div>

        {}

        {}
        {status === 'success' && !syncReport && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4" /> {msg}
          </div>
        )}
        {status === 'error' && !syncReport && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 text-sm break-all">
            <AlertCircle className="w-4 h-4 shrink-0" /> {msg}
          </div>
        )}

        {}
        {syncReport && (
          <div
            className={`mt-6 rounded-lg border ${
              syncReport.errorCount > 0
                ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800'
                : 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
            }`}
          >
            <div className="p-4">
              <h4
                className={`font-bold flex items-center gap-2 ${
                  syncReport.errorCount > 0
                    ? 'text-orange-800 dark:text-orange-300'
                    : 'text-green-800 dark:text-green-300'
                }`}
              >
                {syncReport.errorCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Relatório de Sincronização
              </h4>

              <div className="flex gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {syncReport.success} Sucessos
                </span>
                <span className="flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  {syncReport.errorCount} Falhas
                </span>
              </div>

              {syncReport.errorCount > 0 && (
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800/50">
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-2 uppercase opacity-80">
                    Detalhes das falhas:
                  </p>
                  <ul className="space-y-1">
                    {syncReport.errors.map((err, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-orange-900 dark:text-orange-200 flex items-start gap-2 font-mono bg-white/50 dark:bg-black/20 p-1.5 rounded"
                      >
                        <span className="text-red-500">•</span> {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
