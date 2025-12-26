import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('Usuário não autenticado');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const userService = {
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

    return data.publicUrl;
  },
};
