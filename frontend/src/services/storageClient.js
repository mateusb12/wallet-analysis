import { getAuthHeaders } from './authClient.js';
import { uploadAvatar as uploadSupabaseAvatar } from './supabaseStorageAdapter.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const isLocal = (import.meta.env.VITE_AUTH_PROVIDER || 'supabase').toLowerCase() === 'local';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(file, userId) {
  if (!isLocal) return uploadSupabaseAvatar(file, userId);

  const response = await fetch(`${API_URL}/storage/avatar`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ data_url: await readAsDataUrl(file) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Erro ao fazer upload do avatar');
  return `${API_URL}${data.public_url}`;
}
