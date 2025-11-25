import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useTheme } from '../theme/ThemeContext'; // Import the hook

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  // Access theme context
  const { theme, toggleTheme } = useTheme();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          content: 'Cadastro realizado! Verifique seu email para confirmar.',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setMessage({ type: 'error', content: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors duration-300">

      {/* --- UNIQUE FLOATING TOGGLE --- */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700 group"
        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
      >
        <span className="text-xl group-hover:rotate-12 transition-transform block">
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
      </button>
      {/* ----------------------------- */}

      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 transition-colors duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white transition-colors">
            Investments App
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 transition-colors">
            {isSignUp ? 'Crie sua conta' : 'Entre para acessar suas calculadoras'}
          </p>
        </div>

        {message.content && (
          <div
            className={`p-4 rounded-md mb-6 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                : 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
            }`}
          >
            {message.content}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 flex justify-center shadow-md hover:shadow-lg"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : isSignUp ? (
              'Cadastrar'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 transition-colors">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage({ type: '', content: '' });
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}