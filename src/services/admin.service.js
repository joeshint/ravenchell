import { supabase } from '@/lib/supabase';
import { normalizeReference } from './items.service';

/**
 * Admin data access. Every call relies on the admin RLS policies and on the
 * role checks inside the admin RPCs — a non-admin gets empty results or a
 * permission error from the database, whatever the UI shows.
 */

const ADMIN_PAGE_SIZE = 15;
export { ADMIN_PAGE_SIZE };

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
/** Characters that would break a PostgREST or() expression. */
const cleanForOr = (s) => s.replace(/[,()*:"\\]/g, ' ').trim();

function paged(query, page, pageSize = ADMIN_PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return query.range(start, start + pageSize - 1);
}

async function run(query) {
  const { data, error, count } = await query;
  if (error) {
    if (error.code === 'PGRST103') return { rows: [], total: count ?? 0 };
    throw error;
  }
  return { rows: data, total: count ?? 0 };
}

// -----------------------------------------------------------------------------
// Reports (lost / found)
// -----------------------------------------------------------------------------
const REPORTER = (table) =>
  `reporter:profiles!${table}_reporter_id_fkey(id, full_name, institutional_email, student_employee_id, user_type)`;

const ADMIN_ITEM_COLUMNS = {
  lost:
    'id, reference_no, item_name, description, date_lost, time_lost, location_details, image_path, status, created_at, updated_at, resolved_at, ' +
    'category:item_categories(id, name), campus:campuses(id, name, code), location:campus_locations!lost_items_location_id_fkey(id, name), ' +
    `${REPORTER('lost_items')}`,
  found:
    'id, reference_no, item_name, description, date_found, time_found, location_details, image_path, status, created_at, updated_at, ' +
    'verification_questions, custody_location_id, verified_at, released_at, campus_id, ' +
    'category:item_categories(id, name), campus:campuses(id, name, code), location:campus_locations!found_items_location_id_fkey(id, name), ' +
    'custody:campus_locations!found_items_custody_location_id_fkey(id, name), ' +
    `${REPORTER('found_items')}`,
};

export async function listAdminItems(type, { q, status, campus, category, page = 1 } = {}) {
  const table = type === 'lost' ? 'lost_items' : 'found_items';
  let query = supabase.from(table).select(ADMIN_ITEM_COLUMNS[type], { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (campus) query = query.eq('campus_id', campus);
  if (category) query = query.eq('category_id', category);
  const term = q?.trim();
  if (term) {
    const ref = normalizeReference(term);
    if (ref) query = query.eq('reference_no', ref);
    else if (/^(LST|FND)-/i.test(term)) query = query.ilike('reference_no', `${escapeLike(term.toUpperCase())}%`);
    else query = query.ilike('item_name', `%${escapeLike(term)}%`);
  }
  // Oldest pending first is the natural moderation queue; otherwise newest first.
  query = query.order('created_at', { ascending: status === 'pending' || status === 'pending_verification' });
  return run(paged(query, page));
}

export async function getAdminItem(type, id) {
  const table = type === 'lost' ? 'lost_items' : 'found_items';
  const { data, error } = await supabase.from(table).select(ADMIN_ITEM_COLUMNS[type]).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function reviewLostItem(id, action, notes) {
  const { data, error } = await supabase.rpc('admin_review_lost_item', { p_id: id, p_action: action, p_notes: notes || null });
  if (error) throw error;
  return data;
}

export async function reviewFoundItem(id, action, { notes, questions, custodyLocationId } = {}) {
  const { data, error } = await supabase.rpc('admin_review_found_item', {
    p_id: id,
    p_action: action,
    p_notes: notes || null,
    p_questions: questions ?? null,
    p_custody_location_id: custodyLocationId || null,
  });
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Claims
// -----------------------------------------------------------------------------
const CLAIM_LIST_COLUMNS =
  'id, reference_no, status, created_at, reviewed_at, ' +
  'claimant:profiles!claim_requests_claimant_id_fkey(id, full_name, institutional_email, student_employee_id), ' +
  'found_item:found_items(id, reference_no, item_name, image_path, status)';

const CLAIM_DETAIL_COLUMNS =
  '*, ' +
  'claimant:profiles!claim_requests_claimant_id_fkey(id, full_name, institutional_email, student_employee_id, department, user_type, phone, is_active, created_at), ' +
  'reviewer:profiles!claim_requests_reviewed_by_fkey(full_name), ' +
  'releaser:profiles!claim_requests_released_by_fkey(full_name), ' +
  'lost_item:lost_items(id, reference_no, item_name, description, date_lost, status), ' +
  'found_item:found_items(id, reference_no, item_name, description, image_path, status, date_found, verification_questions, ' +
  'category:item_categories(name), campus:campuses(name, code), location:campus_locations!found_items_location_id_fkey(name), ' +
  'custody:campus_locations!found_items_custody_location_id_fkey(name), ' +
  `${REPORTER('found_items')})`;

export async function listClaims({ q, status, page = 1 } = {}) {
  let query = supabase.from('claim_requests').select(CLAIM_LIST_COLUMNS, { count: 'exact' });
  if (status) query = query.eq('status', status);
  const term = q?.trim();
  if (term) {
    const ref = normalizeReference(term);
    query = ref
      ? query.eq('reference_no', ref)
      : query.ilike('reference_no', `%${escapeLike(term.toUpperCase())}%`);
  }
  query = query.order('created_at', { ascending: status === 'pending' });
  return run(paged(query, page));
}

export async function getAdminClaim(id) {
  const { data, error } = await supabase.from('claim_requests').select(CLAIM_DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Other claims on the same item, so the reviewer sees competing claims. */
export async function getCompetingClaims(foundItemId, excludeId) {
  const { data, error } = await supabase
    .from('claim_requests')
    .select('id, reference_no, status, created_at, claimant:profiles!claim_requests_claimant_id_fkey(full_name)')
    .eq('found_item_id', foundItemId)
    .neq('id', excludeId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function updateClaim(id, action, notes) {
  const { data, error } = await supabase.rpc('admin_update_claim', { p_claim_id: id, p_action: action, p_notes: notes || null });
  if (error) throw error;
  return data;
}

export async function releaseClaim(id, releasedToName, notes) {
  const { data, error } = await supabase.rpc('admin_release_claim', {
    p_claim_id: id,
    p_released_to_name: releasedToName,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------
export async function listUsers({ q, role, active, userType, page = 1 } = {}) {
  let query = supabase
    .from('profiles')
    .select('id, full_name, institutional_email, student_employee_id, department, user_type, role, is_active, avatar_url, created_at', {
      count: 'exact',
    });
  if (role) query = query.eq('role', role);
  if (userType) query = query.eq('user_type', userType);
  if (active === 'active') query = query.eq('is_active', true);
  if (active === 'inactive') query = query.eq('is_active', false);
  const term = q ? cleanForOr(q) : '';
  if (term) {
    const like = `%${escapeLike(term)}%`;
    query = query.or(`full_name.ilike.${like},institutional_email.ilike.${like},student_employee_id.ilike.${like}`);
  }
  query = query.order('created_at', { ascending: false });
  return run(paged(query, page));
}

export async function setUserRole(userId, role) {
  const { data, error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
  return data;
}

export async function setUserActive(userId, active) {
  const { data, error } = await supabase.rpc('admin_set_user_active', { p_user_id: userId, p_active: active });
  if (error) throw error;
  return data;
}

export async function adminUpdateProfile(userId, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id').single();
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Lookups (categories, campuses, locations)
// -----------------------------------------------------------------------------
export async function saveRow(table, values, id) {
  const query = id
    ? supabase.from(table).update(values).eq('id', id).select().single()
    : supabase.from(table).insert(values).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (count === 0) throw new Error('Nothing was deleted. You may not have permission.');
}

/** How many reports reference a category / campus / location (to warn before deleting). */
export async function countUsage(column, id) {
  const [lost, found] = await Promise.all([
    supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq(column, id),
    supabase.from('found_items').select('id', { count: 'exact', head: true }).eq(column, id),
  ]);
  if (lost.error) throw lost.error;
  if (found.error) throw found.error;
  return (lost.count ?? 0) + (found.count ?? 0);
}

// -----------------------------------------------------------------------------
// Analytics, logs, settings
// -----------------------------------------------------------------------------
export async function getAnalytics(from, to) {
  const { data, error } = await supabase.rpc('get_admin_analytics', { p_from: from || null, p_to: to || null });
  if (error) throw error;
  return data;
}

export async function listActivityLogs({ action, entityType, from, to, page = 1, pageSize = ADMIN_PAGE_SIZE } = {}) {
  let query = supabase
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, details, created_at, actor:profiles(id, full_name, institutional_email)', {
      count: 'exact',
    });
  if (action) query = query.ilike('action', `${escapeLike(action)}%`);
  if (entityType) query = query.eq('entity_type', entityType);
  if (from) query = query.gte('created_at', `${from}T00:00:00+08:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999+08:00`);
  query = query.order('created_at', { ascending: false });
  return run(paged(query, page, pageSize));
}

export async function getAllSettings() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, description, is_public, updated_at, editor:profiles(full_name)')
    .order('key');
  if (error) throw error;
  return data;
}

export async function updateSetting(key, value) {
  const { data, error } = await supabase.from('system_settings').update({ value }).eq('key', key).select('key').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Only a super administrator can change system settings.');
  return data;
}

/** Fetch every row of a report table for CSV export (admin only, capped). */
export async function exportRows(type, { from, to } = {}) {
  const table = { lost: 'lost_items', found: 'found_items', claims: 'claim_requests' }[type];
  const columns = {
    lost: 'reference_no, item_name, status, date_lost, created_at, category:item_categories(name), campus:campuses(name), reporter:profiles!lost_items_reporter_id_fkey(full_name, institutional_email)',
    found: 'reference_no, item_name, status, date_found, created_at, released_at, category:item_categories(name), campus:campuses(name), reporter:profiles!found_items_reporter_id_fkey(full_name, institutional_email)',
    claims: 'reference_no, status, created_at, reviewed_at, released_at, released_to_name, claimant:profiles!claim_requests_claimant_id_fkey(full_name, institutional_email), found_item:found_items(reference_no, item_name)',
  }[type];
  let query = supabase.from(table).select(columns).order('created_at', { ascending: false }).limit(5000);
  if (from) query = query.gte('created_at', `${from}T00:00:00+08:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999+08:00`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
