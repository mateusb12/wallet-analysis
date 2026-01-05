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
  XCircle,
  Clock,
  Activity,
  AlertOctagon,
  Wrench
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

  const handleRepairHistory = async () => {
    if (
      !confirm(
        'Isso vai baixar 15 anos de histórico para TODOS os ativos da carteira. Pode levar alguns minutos. Deseja continuar?'
      )
    ) {
      return;
    }

    setLoading(true);
    resetStates();
    setBatchProgress({ current: 0, total: 0, ticker: 'Iniciando reparo...' });

    try {
      const positions = await fetchWalletPositions(true);
      const uniqueTickers = [...new Set(positions.map((p) => p.ticker))];

      const totalTasks = uniqueTickers.length;
      setBatchProgress({ current: 0, total: totalTasks, ticker: '' });

      let stats = { updated: 0, unchanged: 0, errors: 0, errorList: [] };
      let currentStep = 0;

      for (const currentTicker of uniqueTickers) {
        currentStep++;
        setBatchProgress({ current: currentStep, total: totalTasks, ticker: currentTicker });

        try {
          // AQUI ESTÁ O SEGREDOS: force: true
          const res = await syncService.syncTicker(currentTicker, true);

          if (res.success) {
            stats.updated++;
          } else {
            stats.errors++;
            stats.errorList.push(`${currentTicker}: Erro API`);
          }
        } catch (err) {
          stats.errors++;
          stats.errorList.push(`${currentTicker}: ${err.message}`);
        }
      }
      setSyncReport(stats);
      setMsg('Reparo de histórico concluído!');
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setMsg(error.message || 'Erro no reparo.');
    } finally {
      setLoading(false);
      setBatchProgress(null);
    }
  };

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
        if (
          result.action === 'up_to_date' ||
          (result.message && result.message.includes('Já atualizado'))
        ) {
          setStatus('no_change');
          setMsg(result.message || 'Já estava atualizado.');
        } else {
          setStatus('success');
          setMsg(result.message || 'Dados atualizados com sucesso.');
        }
        setTicker('');
      } else {
        throw new Error(result.error || result.message || 'Erro desconhecido.');
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

      const uniqueTickers = [...new Set(positions.map((p) => p.ticker))];

      const indicesToSync = [
        { id: 'IBOV', label: 'Índice IBOVESPA', action: () => syncService.syncIbov() },
        { id: 'IFIX', label: 'Índice IFIX', action: () => syncService.syncIfix('^IFIX') },
        { id: 'CDI', label: 'Taxa CDI', action: () => cdiService.syncCdi() },
        { id: 'IPCA', label: 'Inflação IPCA', action: () => syncIpcaHistory() },
      ];

      const totalTasks = uniqueTickers.length + indicesToSync.length;
      setBatchProgress({ current: 0, total: totalTasks, ticker: '' });

      let stats = { updated: 0, unchanged: 0, errors: 0, errorList: [] };
      let currentStep = 0;

      const processResult = (id, res) => {
        if (res && res.success) {
          if (
            res.action === 'up_to_date' ||
            res.message?.includes('Já atualizado') ||
            res.message?.includes('Sem dados')
          ) {
            stats.unchanged++;
          } else {
            stats.updated++;
          }
        } else {
          stats.errors++;

          stats.errorList.push(`${id}: ${res?.error || res?.message || 'Erro desconhecido'}`);
        }
      };

      for (const currentTicker of uniqueTickers) {
        currentStep++;
        setBatchProgress({ current: currentStep, total: totalTasks, ticker: currentTicker });

        try {
          const res = await syncService.syncTicker(currentTicker);
          processResult(currentTicker, res);
        } catch (err) {
          stats.errors++;
          stats.errorList.push(`${currentTicker}: ${err.message || 'Erro desconhecido'}`);
        }
      }

      for (const indexObj of indicesToSync) {
        currentStep++;
        setBatchProgress({ current: currentStep, total: totalTasks, ticker: indexObj.label });

        try {
          const res = await indexObj.action();
          processResult(indexObj.id, res);
        } catch (err) {
          stats.errors++;
          stats.errorList.push(`${indexObj.id}: ${err.message || 'Erro desconhecido'}`);
        }
      }

      setSyncReport(stats);
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
  const handleIpcaSync = () => executeSync(() => syncIpcaHistory());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Sincronização Manual
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Force a verificação de novos dados na B3/Yahoo.
          </p>
        </div>

        {!batchProgress && (
          <div className="hidden sm:flex items-center gap-2">
            {/* Botão Novo de Reparo */}
            <button
              onClick={handleRepairHistory}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              title="Baixa 15 anos de histórico e corrige preços ajustados"
            >
              <Wrench className="w-4 h-4" />
              Reparar Histórico
            </button>

            {/* Botão Original */}
            <button
              onClick={handleSyncAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              <Layers className="w-4 h-4" />
              Sincronizar Carteira Completa
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {}
        {batchProgress && (
          <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 animate-pulse">
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
            <p className="text-xs text-blue-600/70 dark:text-blue-400 font-mono">
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

        <div className="flex flex-col gap-6">
          {}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ticker Individual (ex: BTLG11)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="DIGITE..."
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase transition-all"
                />
                <button
                  onClick={handleSync}
                  disabled={loading || !ticker}
                  className={`px-6 py-2.5 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${
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

          {}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              Índices de Mercado
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={handleIbovSync}
                disabled={loading}
                className="idx-btn bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-all hover:shadow-sm"
              >
                <LineChart className="w-4 h-4" /> Sync IBOV
              </button>
              <button
                onClick={handleIfixSync}
                disabled={loading}
                className="idx-btn bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-all hover:shadow-sm"
              >
                <TrendingUp className="w-4 h-4" /> Sync IFIX
              </button>
              <button
                onClick={handleIpcaSync}
                disabled={loading}
                className="idx-btn bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-all hover:shadow-sm"
              >
                <BarChart3 className="w-4 h-4" /> Sync IPCA
              </button>
              <button
                onClick={handleCdiSync}
                disabled={loading}
                className="idx-btn bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-all hover:shadow-sm"
              >
                <Landmark className="w-4 h-4" /> Sync CDI
              </button>
            </div>
          </div>
        </div>

        {}
        {!syncReport && msg && (
          <div
            className={`mt-6 p-4 rounded-xl flex items-center gap-3 text-sm border animate-in fade-in slide-in-from-top-2 ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                : status === 'no_change'
                  ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : status === 'no_change' ? (
              <Clock className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{msg}</span>
          </div>
        )}

        {}
        {syncReport && (
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                Resumo da Operação
              </h4>
              <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            {}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 transition-all hover:border-emerald-200">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  {syncReport.updated || 0}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Atualizados
                </span>
              </div>

              {}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 transition-all hover:border-blue-200">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {syncReport.unchanged || 0}
                </span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Sem Mudanças
                </span>
              </div>

              {}
              <div
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  syncReport.errors > 0
                    ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50 hover:border-rose-200'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 opacity-60'
                }`}
              >
                <span
                  className={`text-3xl font-bold mb-1 ${
                    syncReport.errors > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {syncReport.errors || 0}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1 ${
                    syncReport.errors > 0
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <XCircle className="w-3 h-3" /> Falhas
                </span>
              </div>
            </div>

            {}
            {syncReport.errorList && syncReport.errorList.length > 0 && (
              <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/50 overflow-hidden">
                <div className="bg-rose-50 dark:bg-rose-900/20 px-4 py-2 border-b border-rose-100 dark:border-rose-900/30 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">
                    Log de Erros
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-900 p-3 max-h-40 overflow-y-auto custom-scrollbar">
                  <ul className="space-y-2">
                    {syncReport.errorList.map((err, idx) => (
                      <li
                        key={idx}
                        className="text-xs font-mono text-rose-600 dark:text-rose-400 flex items-start gap-2 leading-relaxed"
                      >
                        <span className="select-none opacity-50 mt-0.5">❯</span>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
