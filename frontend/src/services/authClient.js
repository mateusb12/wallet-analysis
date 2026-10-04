import { localAuthAdapter } from './localAuthAdapter.js';
import { supabaseAuthAdapter } from './supabaseAuthAdapter.js';

const authAdapter =
  (import.meta.env.VITE_AUTH_PROVIDER || 'supabase').toLowerCase() === 'local'
    ? localAuthAdapter
    : supabaseAuthAdapter;

export const getSession = () => authAdapter.getSession();
export const onAuthStateChange = (callback) => authAdapter.onAuthStateChange(callback);
export const setSession = (session) => authAdapter.setSession(session);
export const signOut = () => authAdapter.signOut();
export const signInWithGoogle = () => authAdapter.signInWithGoogle();

export async function getAccessToken() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Usuário não autenticado (sessão expirada)');
  return token;
}

export async function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getAccessToken()}`,
  };
}
