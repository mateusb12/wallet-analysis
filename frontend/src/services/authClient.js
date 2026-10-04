import { supabase } from './supabaseClient.js';

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('Usuário não autenticado (sessão expirada)');
  return token;
}

export async function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getAccessToken()}`,
  };
}
