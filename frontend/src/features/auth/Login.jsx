import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { authService, systemService } from '../../services/api';
import { useAuth } from './AuthContext';
import { Wifi, WifiOff, Loader2, Sun, Moon } from 'lucide-react';

export default function Login({ onSwitchToRegister }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ type: '', content: '' });
  const [apiStatus, setApiStatus] = useState('checking');

  const { theme, toggleTheme } = useTheme();
  const { setBackendSession } = useAuth();

  useEffect(() => {
    let mounted = true;
    const checkApiStatus = async () => {
      setApiStatus('checking');
      const isOnline = await systemService.checkHealth();
      if (mounted) setApiStatus(isOnline ? 'online' : 'offline');
    };
    checkApiStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });
    try {
      const data = await authService.login(email, password);
      await setBackendSession(data.session);
    } catch (error) {
      setMessage({ type: 'error', content: error.message });
      setLoading(false);
    }
  };

  const renderApiBadge = () => {
    const baseClasses =
      'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition-colors duration-300';

    if (apiStatus === 'checking') {
      return (
        <div
          className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Checking</span>
        </div>
      );
    }
    if (apiStatus === 'online') {
      return (
        <div
          className={`${baseClasses} bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/50`}
        >
          <Wifi className="w-3 h-3" />
          <span>Servidor Online</span>
        </div>
      );
    }
    return (
      <div
        className={`${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50`}
      >
        <WifiOff className="w-3 h-3" />
        <span>System Offline</span>
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4 transition-colors duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transition-colors duration-300 p-8 pt-12">
        {}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
            Investments App
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm tracking-wide font-medium">
            BEM-VINDO DE VOLTA
          </p>
        </div>

        {}
        {message.content && (
          <div className="p-4 rounded-lg mb-6 text-sm bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {message.content}
          </div>
        )}

        {}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white transition-all placeholder-gray-400"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white transition-all placeholder-gray-400"
              placeholder="••••••••"
            />
            {}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || apiStatus === 'offline'}
            className={`w-full h-12 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/10 ${
              apiStatus === 'offline'
                ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed text-gray-400 dark:text-gray-600 shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/25 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Processando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Não tem uma conta?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold hover:underline transition-colors"
            >
              Cadastre-se
            </button>
          </p>

          {}
          <div className="flex justify-center opacity-80 hover:opacity-100 transition-opacity">
            {renderApiBadge()}
          </div>
        </div>
      </div>
    </div>
  );
}
