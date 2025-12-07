import React, { useState } from 'react';
import { useTheme } from '../features/theme/ThemeContext';
import { useAuth } from '../features/auth/AuthContext';

import { useDataConsistency } from '../hooks/useDataConsistency';
import DataConsistencyAlert from '../components/DataConsistencyAlert';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const { warnings } = useDataConsistency();

  const [notifications, setNotifications] = useState({
    email: true,
    browser: false,
    offers: false,
  });
  const [apiKey, setApiKey] = useState('hg_29384...8s7d');

  const userEmail = user?.email || 'usuario@exemplo.com';
  const userName = userEmail.split('@')[0];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Configurações</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      {}
      <DataConsistencyAlert warnings={warnings} className="mb-8" />

      <div className="space-y-6">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">JPG ou PNG. Max 1MB.</p>
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
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Salvar Alterações
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
            {}
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
              <p className="text-xs text-gray-500 mt-2">
                Usada para buscar dados históricos de FIIs com mais precisão.
              </p>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta ação é permanente e não pode ser desfeita.
                </p>
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
