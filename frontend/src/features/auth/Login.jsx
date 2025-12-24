import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { authService, systemService } from '../../services/api';
import { supabase } from '../../services/supabaseClient';
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

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Erro Google:', error);
      setMessage({ type: 'error', content: error.message });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });
    try {
      const data = await authService.login(email, password);
      await setBackendSession(data.session);
    } catch (error) {
      console.error('Erro de Login:', error);
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
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
            Investments App
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm tracking-wide font-medium">
            BEM-VINDO DE VOLTA
          </p>
        </div>

        {message.content && (
          <div className="p-4 rounded-lg mb-6 text-sm bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {message.content}
          </div>
        )}

        {}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-12 flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-all duration-200 shadow-sm hover:shadow active:scale-[0.98]"
          >
            {}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase">
            Ou use seu email
          </span>
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
        </div>

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

          <div className="flex justify-center opacity-80 hover:opacity-100 transition-opacity">
            {renderApiBadge()}
          </div>
        </div>
      </div>
    </div>
  );
}
