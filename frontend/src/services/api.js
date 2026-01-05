import { supabase } from './supabaseClient.js';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL;

  if (!url) {
    console.warn('⚠️ VITE_API_URL não encontrada. Usando localhost.');
    url = 'http://localhost:8000';
  }

  return url.replace(/\/$/, '');
};

const API_URL = getBaseUrl();

console.log('🔌 API Base URL:', API_URL);

export const authService = {
  async login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Login failed');
    return data;
  },

  async register(email, password, confirmPassword) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Registration failed');
    return data;
  },
};

export const systemService = {
  async checkHealth() {
    try {
      const response = await fetch(`${API_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      return response.ok;
    } catch (error) {
      console.error('Health Check falhou:', error);
      return false;
    }
  },
};

export const syncService = {
  async syncTicker(ticker, force = false) {
    const response = await fetch(`${API_URL}/sync/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, force }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Sync failed');
    return data;
  },

  async syncIfix(ticker) {
    const response = await fetch(`${API_URL}/sync/ifix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'IFIX Sync failed');
    return data;
  },

  async syncIbov() {
    const response = await fetch(`${API_URL}/sync/ibov`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'IBOV Sync failed');
    return data;
  },
};

export const analysisService = {
  async getZScore(ticker, windowMonths = 12) {
    const response = await fetch(
      `${API_URL}/analysis/zscore/${ticker}?window_months=${windowMonths}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to fetch analysis');
    return data;
  },

  async runFiiSimulation(payload) {
    const response = await fetch(`${API_URL}/analysis/simulation/fii`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Simulation failed');
    return data;
  },

  async getOpportunities() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) throw new Error('User not authenticated');

    const response = await fetch(`${API_URL}/analysis/opportunities`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to fetch opportunities');
    return data;
  },
};
