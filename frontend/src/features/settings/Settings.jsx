import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { userService } from '../../services/userService.js';
import { jobService } from '../../services/api.js';
import { getWalletPurchases, getWalletProventos } from '../../services/walletDataService.js';

import ManualPriceSync from '../../components/ManualPriceSync.jsx';
import ContributionsManager from './ContributionsManager.jsx';
import { formatDateTimeLong } from '../../utils/dateUtils.js';

import { CheckCircle2, ChevronDown, Clock3, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';

const monthNumbers = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};
const monthNames = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const normalizeDate = (value) => {
  if (!value) return '';
  const text = String(value).trim().toLowerCase();
  const brazilianDate = text.match(/(\d{1,2})\s+de\s+([a-zà-ÿ]+)\s+de\s+(\d{4})/i);
  if (brazilianDate) {
    const month = monthNumbers[brazilianDate[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    if (month) return `${brazilianDate[3]}-${month}-${brazilianDate[1].padStart(2, '0')}`;
  }
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoDate) return isoDate[0];
  const slashDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return slashDate ? `${slashDate[3]}-${slashDate[2]}-${slashDate[1]}` : text;
};

const normalizeTicker = (value) => {
  const match = String(value || '').match(/\b[A-Z]{4}\d{1,2}F?\b/i)?.[0].toUpperCase() || '';
  return match.endsWith('F') ? match.slice(0, -1) : match;
};

const parseBrazilianNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const normalizeProventoText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const findRegisteredProvento = (contribution, proventos) => {
  const date = normalizeDate(contribution.date);
  const type = normalizeProventoText(contribution.movement);
  const product = normalizeProventoText(contribution.product);
  const quantity = parseBrazilianNumber(contribution.quantity);
  const totalValue = parseBrazilianNumber(contribution.total);
  if (!date || !type || !product || quantity === null || totalValue === null) return null;

  return proventos.find((provento) => (
    normalizeDate(provento.date) === date
    && normalizeProventoText(provento.type) === type
    && normalizeProventoText(provento.product) === product
    && Math.abs(Number(provento.quantity) - quantity) <= 0.0001
    && Math.abs(Number(provento.total_value) - totalValue) <= 0.01
  )) || null;
};

const confirmedSettlementDates = {
  '2026-10-26|BBAS3|11|17.78': '2026-10-28',
  '2026-10-26|BBAS3|56|17.91': '2026-10-28',
  '2026-10-26|MDIA3|45|16.34': '2026-10-28',
  '2026-10-05|AUPO11|1|111.63': '2026-10-06',
};

const getConfirmedSettlementDate = (contribution) => {
  const ticker = normalizeTicker(contribution.product);
  const quantity = parseBrazilianNumber(contribution.quantity);
  const price = parseBrazilianNumber(contribution.price);
  if (!ticker || quantity === null || price === null) return null;

  const key = `${normalizeDate(contribution.date)}|${ticker}|${quantity}|${price.toFixed(2)}`;
  return confirmedSettlementDates[key] || null;
};

const findRegisteredPurchase = (contribution, purchases) => {
  const ticker = normalizeTicker(contribution.product);
  const date = normalizeDate(contribution.date);
  const quantity = parseBrazilianNumber(contribution.quantity);
  const price = parseBrazilianNumber(contribution.price);
  if (!ticker || !date || quantity === null || quantity < 0) return null;

  return purchases.find((purchase) => {
    if (String(purchase.ticker || '').toUpperCase() !== ticker) return false;
    const purchaseTradeDate = normalizeDate(purchase.trade_date);
    const matchesDate = purchaseTradeDate
      ? purchaseTradeDate === date
      : normalizeDate(purchase.settlement_date) === date;
    if (!matchesDate) return false;
    if (Math.abs(Number(purchase.qty) - quantity) > 0.0001) return false;
    return price === null || Math.abs(Number(purchase.price) - price) <= 0.01;
  }) || null;
};

const formatIsoDate = (value) => {
  const normalized = normalizeDate(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const [, year, month, day] = match;
  return `${Number(day)} de ${monthNames[Number(month) - 1]} de ${year}`;
};

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const avatarInputRef = useRef(null);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [dbName, setDbName] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [existingPurchases, setExistingPurchases] = useState([]);
  const [existingProventos, setExistingProventos] = useState([]);
  const [isProventosExpanded, setIsProventosExpanded] = useState(true);
  const [isContributionsExpanded, setIsContributionsExpanded] = useState(true);
  const [jobStatus, setJobStatus] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wallet-analysis:scraper-job-status') || '{"status":"idle"}');
    } catch {
      return { status: 'idle' };
    }
  });
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [jobError, setJobError] = useState('');
  const [scraperRequests, setScraperRequests] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wallet-analysis:scraper-requests') || '[]');
    } catch {
      return [];
    }
  });
  const [scraperContributions, setScraperContributions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wallet-analysis:scraper-contributions') || '[]');
    } catch {
      return [];
    }
  });
  const [scraperDividends, setScraperDividends] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wallet-analysis:scraper-dividends') || '[]');
    } catch {
      return [];
    }
  });

  const userEmail = user?.email || 'usuario@exemplo.com';
  const displayName = dbName || userEmail.split('@')[0];
  const registeredContributionCount = scraperContributions.filter((contribution) => (
    findRegisteredPurchase(contribution, existingPurchases)
  )).length;
  const pendingContributionCount = scraperContributions.length - registeredContributionCount;
  const registeredProventoCount = scraperDividends.filter((contribution) => (
    findRegisteredProvento(contribution, existingProventos)
  )).length;
  const pendingProventoCount = scraperDividends.length - registeredProventoCount;

  useEffect(() => {
    if (user?.id) {
      fetchExistingPurchases();
      fetchExistingProventos();
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    fetchJobStatus();
  }, []);

  useEffect(() => {
    if (jobStatus.status !== 'running') return undefined;

    const interval = setInterval(fetchJobStatus, 1000);
    return () => clearInterval(interval);
  }, [jobStatus.status]);

  useEffect(() => {
    if (jobStatus.status !== 'running') return undefined;
    const refreshRequests = async () => {
      try {
        const requests = await jobService.getScraperRequests();
        setScraperRequests(requests);
        localStorage.setItem('wallet-analysis:scraper-requests', JSON.stringify(requests));
      } catch (error) {
        setJobError(error.message);
      }
    };
    refreshRequests();
    const interval = setInterval(refreshRequests, 1000);
    return () => clearInterval(interval);
  }, [jobStatus.status]);

  useEffect(() => {
    if (jobStatus.status !== 'running') return undefined;
    const refreshContributions = async () => {
      try {
        const contributions = await jobService.getScraperContributions();
        setScraperContributions(contributions);
        localStorage.setItem('wallet-analysis:scraper-contributions', JSON.stringify(contributions));
      } catch (error) {
        setJobError(error.message);
      }
    };
    refreshContributions();
    const interval = setInterval(refreshContributions, 1000);
    return () => clearInterval(interval);
  }, [jobStatus.status]);

  useEffect(() => {
    if (jobStatus.status !== 'running') return undefined;
    const refreshDividends = async () => {
      try {
        const dividends = await jobService.getScraperDividends();
        setScraperDividends(dividends);
        localStorage.setItem('wallet-analysis:scraper-dividends', JSON.stringify(dividends));
      } catch (error) {
        setJobError(error.message);
      }
    };
    refreshDividends();
    const interval = setInterval(refreshDividends, 1000);
    return () => clearInterval(interval);
  }, [jobStatus.status]);

  const fetchJobStatus = async () => {
    try {
      const status = await jobService.getScraperStatus();
      setJobStatus(status);
      localStorage.setItem('wallet-analysis:scraper-job-status', JSON.stringify(status));
    } catch (error) {
      setJobError(error.message);
    }
  };

  const handleRunScraper = async () => {
    setIsStartingJob(true);
    setJobError('');
    setScraperRequests([]);
    setScraperContributions([]);
    setScraperDividends([]);
    localStorage.removeItem('wallet-analysis:scraper-requests');
    localStorage.removeItem('wallet-analysis:scraper-contributions');
    localStorage.removeItem('wallet-analysis:scraper-dividends');
    localStorage.setItem(
      'wallet-analysis:scraper-job-status',
      JSON.stringify({
        ...jobStatus,
        status: 'running',
        error: null,
        finished_at: null,
        progress: { current: 0, total: 1, label: 'Iniciando execução' },
      })
    );

    try {
      const result = await jobService.runScraper();
      setJobStatus((current) => {
        const nextStatus = { ...current, ...result };
        localStorage.setItem('wallet-analysis:scraper-job-status', JSON.stringify(nextStatus));
        return nextStatus;
      });
      await fetchJobStatus();
    } catch (error) {
      setJobError(error.message);
    } finally {
      setIsStartingJob(false);
    }
  };

  const handlePauseScraper = async () => {
    setIsStartingJob(true);
    setJobError('');

    try {
      const result = await jobService.pauseScraper();
      setJobStatus((current) => {
        const nextStatus = { ...current, ...result };
        localStorage.setItem('wallet-analysis:scraper-job-status', JSON.stringify(nextStatus));
        return nextStatus;
      });
      await fetchJobStatus();
    } catch (error) {
      setJobError(error.message);
    } finally {
      setIsStartingJob(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await userService.getProfile();
      if (profile) {
        setAvatarUrl(profile.avatar_url);
        setDbName(profile.full_name || '');
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = async (event) => {
    if (!event.target.files || event.target.files.length === 0) return;

    try {
      setIsUploadingAvatar(true);
      const file = event.target.files[0];

      const publicUrl = await userService.uploadAvatar(file, user.id);
      const updatedProfile = await userService.updateProfile({ avatar_url: publicUrl });

      setAvatarUrl(updatedProfile.avatar_url);
    } catch (error) {
      console.error('Erro no upload do avatar:', error);
      alert('Erro ao atualizar avatar: ' + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleNameBlur = async () => {
    try {
      await userService.updateProfile({ full_name: dbName });
    } catch (error) {
      console.error('Erro ao salvar nome:', error);
    }
  };

  const fetchExistingPurchases = async () => {
    try {
      const purchases = await getWalletPurchases();
      setExistingPurchases(purchases);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchExistingProventos = async () => {
    try {
      const proventos = await getWalletProventos();
      setExistingProventos(proventos);
    } catch (error) {
      console.error('Falha ao buscar proventos:', error);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Configurações</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="space-y-6">
        <ManualPriceSync />

        {}
        <ContributionsManager
          purchases={existingPurchases}
          onRefresh={fetchExistingPurchases}
          userId={user?.id}
        />

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
              {}
              <div className="relative h-16 w-16 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center border border-gray-200 dark:border-gray-600 shadow-sm">
                {isUploadingAvatar ? (
                  <RefreshCw className="w-6 h-6 text-white animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">
                    {userEmail.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                {}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 transition-colors"
                >
                  {isUploadingAvatar ? 'Enviando...' : 'Alterar Avatar'}
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
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder={displayName}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                <Clock3 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jobs</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Execuções automáticas em segundo plano
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-700/50 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">Scraper de dados</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Coleta e atualização dos dados do site
                </p>
              </div>
              <div className="flex items-center gap-2 justify-self-start md:justify-self-center">
                {jobStatus.status === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : jobStatus.status === 'failed' ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : jobStatus.status === 'paused' || jobStatus.status === 'stopped' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {jobStatus.status === 'running'
                    ? jobStatus.progress
                      ? `${jobStatus.progress.current}/${jobStatus.progress.total} — ${jobStatus.progress.label}`
                      : 'Executando'
                    : jobStatus.status === 'failed'
                      ? 'Falhou'
                      : jobStatus.status === 'paused'
                        ? 'Pausada'
                        : jobStatus.status === 'stopped'
                          ? 'Concluída'
                        : 'Parada'}
                </span>
              </div>
              {jobStatus.status === 'running' ? (
                <button
                  onClick={handlePauseScraper}
                  disabled={isStartingJob}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="h-3 w-3 rounded-sm bg-current" />
                  Pausar
                </button>
              ) : (
                <button
                  onClick={handleRunScraper}
                  disabled={isStartingJob}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Executar agora
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Iniciada em
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatDateTimeLong(jobStatus.started_at)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Finalizada em
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatDateTimeLong(jobStatus.finished_at)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Agendamento
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  Diária via cron
                </p>
              </div>
            </div>
            {jobStatus.error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{jobStatus.error}</p>
            )}
            {jobError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{jobError}</p>}

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsProventosExpanded((expanded) => !expanded)}
                aria-expanded={isProventosExpanded}
                aria-controls="proventos-captured-table"
                className="mb-3 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700/60"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Proventos</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rendimentos e dividendos encontrados na aba Movimentação da B3</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    No SQL: {registeredProventoCount} cadastrados · {pendingProventoCount} pendentes
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {scraperDividends.length}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isProventosExpanded ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isProventosExpanded && <div id="proventos-captured-table" className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Quantidade</th>
                      <th className="px-3 py-2">Valor total</th>
                      <th className="px-3 py-2">Status no SQL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scraperDividends.map((dividend, index) => {
                      const registeredProvento = findRegisteredProvento(dividend, existingProventos);
                      return (
                      <tr
                        key={dividend.id || index}
                        className={`border-t border-gray-200 dark:border-gray-700 ${
                          registeredProvento ? '' : 'bg-orange-500/10 dark:bg-orange-500/15'
                        }`}
                        title={registeredProvento ? 'Provento cadastrado no SQL' : 'Provento pendente no SQL'}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{dividend.date || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{dividend.movement || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{dividend.product || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{dividend.quantity || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{dividend.total || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            registeredProvento
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                          }`}>
                            {registeredProvento ? 'Cadastrado' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                    {scraperDividends.length === 0 && (
                      <tr><td colSpan="6" className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Nenhum provento encontrado ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>}
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsContributionsExpanded((expanded) => !expanded)}
                aria-expanded={isContributionsExpanded}
                aria-controls="contributions-captured-table"
                className="mb-3 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700/60"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Aportes capturados</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Compras encontradas na aba Negociação da B3</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    No SQL: {registeredContributionCount} cadastrados · {pendingContributionCount} pendentes
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {scraperContributions.length}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isContributionsExpanded ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isContributionsExpanded && <div id="contributions-captured-table" className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Data negociação (B3)</th>
                      <th className="px-3 py-2">Data liquidação</th>
                      <th className="px-3 py-2">Status no SQL</th>
                      <th className="px-3 py-2">Movimentação</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Quantidade</th>
                      <th className="px-3 py-2">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scraperContributions.map((contribution, index) => {
                      const registeredPurchase = findRegisteredPurchase(contribution, existingPurchases);
                      return (
                      <tr
                        key={contribution.id || index}
                        className={`border-t border-gray-200 dark:border-gray-700 ${
                          registeredPurchase ? '' : 'bg-orange-500/10 dark:bg-orange-500/15'
                        }`}
                        title={registeredPurchase ? 'Aporte já cadastrado' : 'Aporte ainda não cadastrado'}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{contribution.date || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                          {formatIsoDate(registeredPurchase?.settlement_date || getConfirmedSettlementDate(contribution))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            registeredPurchase
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                          }`}>
                            {registeredPurchase ? 'Cadastrado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{contribution.movement || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{contribution.product || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{contribution.quantity || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{contribution.total || '—'}</td>
                      </tr>
                      );
                    })}
                    {scraperContributions.length === 0 && (
                      <tr><td colSpan="7" className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Nenhum aporte capturado ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>}
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Requisições capturadas</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Atualização em tempo real durante a execução</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{scraperRequests.length}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Método</th>
                      <th className="px-3 py-2">URL</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scraperRequests.slice(-50).reverse().map((request) => (
                      <tr key={request.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900 dark:text-white">{request.method}</td>
                        <td className="max-w-[34rem] truncate px-3 py-2 text-gray-600 dark:text-gray-300" title={request.url}>{request.url}</td>
                        <td className={`whitespace-nowrap px-3 py-2 ${request.failed ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>{request.failed ? 'Falhou' : request.status || '...'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-500 dark:text-gray-400">{request.resourceType}</td>
                      </tr>
                    ))}
                    {scraperRequests.length === 0 && (
                      <tr><td colSpan="4" className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Nenhuma requisição capturada ainda.</td></tr>
                    )}
                  </tbody>
                </table>
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
