import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { userService } from '../../services/userService.js';
import { jobService } from '../../services/api.js';

import ManualPriceSync from '../../components/ManualPriceSync.jsx';
import ContributionsManager from './ContributionsManager.jsx';
import { formatDateTimeLong } from '../../utils/dateUtils.js';

import { CheckCircle2, Clock3, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const avatarInputRef = useRef(null);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [dbName, setDbName] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [existingPurchases, setExistingPurchases] = useState([]);
  const [jobStatus, setJobStatus] = useState({ status: 'idle' });
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [jobError, setJobError] = useState('');

  const userEmail = user?.email || 'usuario@exemplo.com';
  const displayName = dbName || userEmail.split('@')[0];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (user?.id) {
      fetchExistingPurchases();
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    fetchJobStatus();
  }, []);

  useEffect(() => {
    if (jobStatus.status !== 'running') return undefined;

    const interval = setInterval(fetchJobStatus, 5000);
    return () => clearInterval(interval);
  }, [jobStatus.status]);

  const fetchJobStatus = async () => {
    try {
      const status = await jobService.getScraperStatus();
      setJobStatus(status);
    } catch (error) {
      setJobError(error.message);
    }
  };

  const handleRunScraper = async () => {
    setIsStartingJob(true);
    setJobError('');

    try {
      const result = await jobService.runScraper();
      setJobStatus((current) => ({ ...current, ...result }));
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
      const response = await fetch(`${API_URL}/wallet/purchases?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setExistingPurchases(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
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
                ) : jobStatus.status === 'stopped' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {jobStatus.status === 'running'
                    ? 'Executando'
                    : jobStatus.status === 'failed'
                      ? 'Falhou'
                      : jobStatus.status === 'stopped'
                        ? 'Concluída'
                        : 'Parada'}
                </span>
              </div>
              <button
                onClick={handleRunScraper}
                disabled={isStartingJob || jobStatus.status === 'running'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Executar agora
              </button>
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
