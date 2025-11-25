import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useTheme } from '../theme/ThemeContext';

export default function Register({ onSwitchToLogin }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState({ type: '', content: '' });

  const { theme, toggleTheme } = useTheme();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', content: 'As senhas não coincidem.' });
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setMessage({ type: 'error', content: 'A senha deve ter pelo menos 6 caracteres.' });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        content:
          'Cadastro realizado com sucesso! Verifique seu email para confirmar o link de acesso.',
      });

      setFormData({ email: '', password: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ type: 'error', content: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors duration-300">
      {}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 border border-gray-200 dark:border-gray-700 group"
      >
        <span className="text-xl group-hover:rotate-12 transition-transform block">
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
      </button>

      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 transition-colors duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Criar Conta</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Junte-se ao Investments App</p>
        </div>

        {message.content && (
          <div
            className={`p-4 rounded-md mb-6 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300'
            }`}
          >
            {message.content}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Senha
            </label>
            <input
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmar Senha
            </label>
            <input
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 mt-4"
          >
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={onSwitchToLogin}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Já tem uma conta? Entre aqui
          </button>
        </div>
      </div>
    </div>
  );
}
