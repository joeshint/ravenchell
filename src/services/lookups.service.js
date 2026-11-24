import { supabase } from '@/lib/supabase';

export async function getCategories() {
  const { data, error } = await supabase
    .from('item_categories')
    .select('id, name, slug, description, icon, sort_order, is_active')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getCampuses() {
  const { data, error } = await supabase
    .from('campuses')
    .select('id, name, code, address, sort_order, is_active')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getLocations(campusId) {
  let query = supabase
    .from('campus_locations')
    .select('id, campus_id, name, description, is_custody_point, is_active')
    .order('name');
  if (campusId) query = query.eq('campus_id', campusId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Settings marked is_public, as a { key: value } object. */
export async function getPublicSettings() {
  const { data, error } = await supabase.from('system_settings').select('key, value').eq('is_public', true);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}
