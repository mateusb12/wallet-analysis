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
          className={`${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400`}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Checking</span>
        </div>
      );
    }
    if (apiStatus === 'online') {
      return (
        <div
          className={`${baseClasses} bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800`}
        >
          <Wifi className="w-3 h-3" />
          <span>Online</span>
        </div>
      );
    }
    return (
      <div
        className={`${baseClasses} bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800`}
      >
        <WifiOff className="w-3 h-3" />
        <span>Offline</span>
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-colors duration-300 p-8">
        {}
        {}
        <div className="relative flex items-center justify-center mb-1">
          {}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investments App</h1>

          {}
          <button
            onClick={toggleTheme}
            className="absolute right-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-all duration-200"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {}
        <div className="text-center mb-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Bem-vindo de volta</p>

          {}
          <div className="flex justify-center mt-3">{renderApiBadge()}</div>
        </div>

        {message.content && (
          <div className="p-3 rounded-lg mb-6 text-sm bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
            {message.content}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white transition-all placeholder-gray-400"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Senha
              </label>
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white transition-all placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || apiStatus === 'offline'}
            className={`w-full font-bold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm ${
              apiStatus === 'offline'
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500 dark:text-gray-400">Não tem uma conta? </span>
          <button
            onClick={onSwitchToRegister}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Cadastre-se
          </button>
        </div>
      </div>
    </div>
  );
}
