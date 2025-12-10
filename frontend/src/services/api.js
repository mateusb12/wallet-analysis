const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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

export const syncService = {
  async syncTicker(ticker) {
    const response = await fetch(`${API_URL}/sync/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
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
};
