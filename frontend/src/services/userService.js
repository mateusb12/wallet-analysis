import { getAuthHeaders } from './authClient.js';
import { uploadAvatar } from './storageClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const userService = {
  ensureProfile: async (user) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name,
        avatar_url: user.user_metadata?.avatar_url,
      }),
    });

    if (!response.ok) throw new Error('Erro ao garantir perfil');
    return response.json();
  },

  getProfile: async () => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) throw new Error('Erro ao buscar perfil');
    return await response.json();
  },

  updateProfile: async (data) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Erro ao atualizar perfil');
    return await response.json();
  },

  uploadAvatar: async (file, userId) => {
    return uploadAvatar(file, userId);
  },
};
