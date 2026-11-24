import { supabase } from '@/lib/supabase';

export async function getPublicStats() {
  const { data, error } = await supabase.rpc('get_public_stats');
  if (error) throw error;
  return data;
}
