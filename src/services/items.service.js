import { supabase } from '@/lib/supabase';
import { PAGE_SIZE } from '@/lib/constants';
import { removeFile, uploadFile } from './storage.service';

/**
 * Columns safe for public listings. Private details live in *_private tables
 * and are never selected here.
 */
export const LOST_LIST_COLUMNS =
  'id, reference_no, reporter_id, item_name, description, date_lost, time_lost, location_details, image_path, status, created_at, ' +
  'category:item_categories(id, name, icon), campus:campuses(id, name, code), location:campus_locations!lost_items_location_id_fkey(id, name)';

export const FOUND_LIST_COLUMNS =
  'id, reference_no, reporter_id, item_name, description, date_found, time_found, location_details, image_path, status, created_at, ' +
  'category:item_categories(id, name, icon), campus:campuses(id, name, code), location:campus_locations!found_items_location_id_fkey(id, name)';

const LOST_DETAIL_COLUMNS = `${LOST_LIST_COLUMNS}, category_id, campus_id, location_id, resolved_at, updated_at`;

const FOUND_DETAIL_COLUMNS =
  `${FOUND_LIST_COLUMNS}, category_id, campus_id, location_id, custody_location_id, verification_questions, ` +
  'verified_at, released_at, updated_at, ' +
  'custody:campus_locations!found_items_custody_location_id_fkey(id, name, campus:campuses(name, code))';

const TABLE = { lost: 'lost_items', found: 'found_items' };
const PRIVATE_TABLE = { lost: 'lost_item_private', found: 'found_item_private' };
const PRIVATE_FK = { lost: 'lost_item_id', found: 'found_item_id' };
const DATE_COLUMN = { lost: 'date_lost', found: 'date_found' };

/** Statuses that appear in public listings. */
export const PUBLIC_STATUSES = {
  lost: ['approved', 'resolved'],
  found: ['verified', 'claimed', 'released'],
};

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * A complete reference number in canonical form, or null. The database
 * zero-pads the sequence to 6 digits (LST-2026-000042), so "lst-2026-42"
 * must be padded before an exact match.
 */
export function normalizeReference(term) {
  const m = /^(LST|FND|CLM)-(\d{4})-(\d{1,6})$/i.exec(term?.trim() ?? '');
  return m ? `${m[1].toUpperCase()}-${m[2]}-${m[3].padStart(6, '0')}` : null;
}

/**
 * Public listing with search, filters, sorting and pagination.
 * Returns { rows, total }.
 */
export async function listItems(
  type,
  { q, category, campus, status, from, to, sort = 'newest', page = 1, pageSize = PAGE_SIZE } = {},
) {
  let query = supabase
    .from(TABLE[type])
    .select(type === 'lost' ? LOST_LIST_COLUMNS : FOUND_LIST_COLUMNS, { count: 'exact' });

  query = PUBLIC_STATUSES[type].includes(status)
    ? query.eq('status', status)
    : query.in('status', PUBLIC_STATUSES[type]);

  const term = q?.trim();
  if (term) {
    const ref = normalizeReference(term);
    query = ref ? query.eq('reference_no', ref) : query.ilike('item_name', `%${escapeLike(term)}%`);
  }
  if (category) query = query.eq('category_id', category);
  if (campus) query = query.eq('campus_id', campus);
  if (from) query = query.gte(DATE_COLUMN[type], from);
  if (to) query = query.lte(DATE_COLUMN[type], to);

  if (sort === 'oldest') query = query.order('created_at', { ascending: true });
  else if (sort === 'date') {
    query = query.order(DATE_COLUMN[type], { ascending: false }).order('created_at', { ascending: false });
  } else query = query.order('created_at', { ascending: false });

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error) {
    // Requesting a page past the end (e.g. after filters shrink the results).
    if (error.code === 'PGRST103') return { rows: [], total: count ?? 0 };
    throw error;
  }
  return { rows: data, total: count ?? 0 };
}

export async function getRecentFoundItems(limit = 4) {
  const { data, error } = await supabase
    .from('found_items')
    .select(FOUND_LIST_COLUMNS)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getRecentLostItems(limit = 4) {
  const { data, error } = await supabase
    .from('lost_items')
    .select(LOST_LIST_COLUMNS)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** One item. RLS returns nothing if the caller may not see it. */
export async function getItem(type, id) {
  const { data, error } = await supabase
    .from(TABLE[type])
    .select(type === 'lost' ? LOST_DETAIL_COLUMNS : FOUND_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Sensitive details — only the reporter and admins get a row back. */
export async function getItemPrivate(type, id) {
  const { data, error } = await supabase.from(PRIVATE_TABLE[type]).select('*').eq(PRIVATE_FK[type], id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyReports(type, userId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from(TABLE[type])
    .select(type === 'lost' ? LOST_LIST_COLUMNS : FOUND_LIST_COLUMNS)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Timeline of status changes (owner/admin only via RLS). */
export async function getStatusHistory(entityType, entityId) {
  const { data, error } = await supabase
    .from('item_status_history')
    .select('id, from_status, to_status, note, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

function rpcParams(type, v, imagePath) {
  const common = {
    p_item_name: v.itemName,
    p_category_id: v.categoryId,
    p_description: v.description,
    p_campus_id: v.campusId,
    p_location_id: v.locationId || null,
    p_location_details: v.locationDetails || null,
    p_image_path: imagePath ?? null,
    p_identifying_details: v.identifyingDetails || null,
  };
  if (type === 'lost') {
    return {
      ...common,
      p_date_lost: v.date,
      p_time_lost: v.time || null,
      p_contact_name: v.contactName || null,
      p_contact_phone: v.contactPhone || null,
      p_contact_email: v.contactEmail || null,
    };
  }
  return {
    ...common,
    p_date_found: v.date,
    p_time_found: v.time || null,
    p_custody_location_id: v.custodyLocationId || null,
    p_additional_info: v.additionalInfo || null,
    p_custody_notes: v.custodyNotes || null,
  };
}

/**
 * Create (no `id`) or update a report, handling the photo:
 *   image = { file: File | null, keepExisting: boolean }
 * A newly uploaded photo is removed again if saving fails; a replaced or
 * removed photo is deleted after a successful save.
 */
export async function saveReport({ type, id, values, image, existingPath, userId }) {
  let uploadedPath = null;
  if (image?.file) uploadedPath = await uploadFile('item-images', image.file, userId);
  const finalPath = uploadedPath ?? (image?.keepExisting ? existingPath : null);

  let row;
  try {
    const fn = id ? `update_${type}_report` : `submit_${type}_report`;
    const params = rpcParams(type, values, finalPath);
    const { data, error } = await supabase.rpc(fn, id ? { p_id: id, ...params } : params);
    if (error) throw error;
    row = data;
  } catch (err) {
    if (uploadedPath) await removeFile('item-images', uploadedPath);
    throw err;
  }

  if (existingPath && existingPath !== finalPath) await removeFile('item-images', existingPath);
  return row;
}

export async function deleteReport(type, item) {
  const { error, count } = await supabase.from(TABLE[type]).delete({ count: 'exact' }).eq('id', item.id);
  if (error) throw error;
  if (count === 0) throw new Error('This report can no longer be deleted.');
  await removeFile('item-images', item.image_path);
}

export async function markLostItemRecovered(id) {
  const { data, error } = await supabase.rpc('mark_my_lost_item_resolved', { p_id: id });
  if (error) throw error;
  return data;
}
