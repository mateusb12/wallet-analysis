import { supabase } from './supabaseClient.js';

export async function uploadAvatar(file, userId) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}-${Math.random()}.${fileExt}`;
  const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
}
