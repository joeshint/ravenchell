import { supabase } from '@/lib/supabase';
import { removeFile, uploadFile } from './storage.service';

export const ACTIVE_CLAIM_STATUSES = ['pending', 'under_review', 'approved'];

const CLAIM_LIST_COLUMNS =
  'id, reference_no, status, created_at, updated_at, ' +
  'found_item:found_items(id, reference_no, item_name, image_path, status, category:item_categories(name), campus:campuses(name, code))';

const CLAIM_DETAIL_COLUMNS =
  'id, reference_no, status, ownership_description, verification_answers, evidence_path, contact_phone, ' +
  'lost_item_id, review_notes, reviewed_at, released_at, released_to_name, release_notes, created_at, updated_at, ' +
  'lost_item:lost_items(id, reference_no, item_name), ' +
  'found_item:found_items(id, reference_no, item_name, image_path, status, date_found, ' +
  'category:item_categories(name), campus:campuses(name, code), ' +
  'custody:campus_locations!found_items_custody_location_id_fkey(name, campus:campuses(name)))';

/**
 * Submits a claim. Evidence (optional) is uploaded to the private
 * claim-evidence bucket first and removed again if the insert fails.
 */
export async function submitClaim({ userId, foundItemId, values, questions, evidenceFile }) {
  let evidencePath = null;
  if (evidenceFile) evidencePath = await uploadFile('claim-evidence', evidenceFile, userId);

  try {
    const { data, error } = await supabase
      .from('claim_requests')
      .insert({
        found_item_id: foundItemId,
        claimant_id: userId,
        lost_item_id: values.lostItemId || null,
        ownership_description: values.ownershipDescription,
        verification_answers: questions.map((question, i) => ({ question, answer: values.answers[i] ?? '' })),
        evidence_path: evidencePath,
        contact_phone: values.contactPhone || null,
      })
      .select('id, reference_no')
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    if (evidencePath) await removeFile('claim-evidence', evidencePath);
    throw err;
  }
}

export async function getMyClaims(userId) {
  const { data, error } = await supabase
    .from('claim_requests')
    .select(CLAIM_LIST_COLUMNS)
    .eq('claimant_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function getClaim(id) {
  const { data, error } = await supabase.from('claim_requests').select(CLAIM_DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** The user's open claim on an item, if any. */
export async function getMyActiveClaimForItem(foundItemId, userId) {
  const { data, error } = await supabase
    .from('claim_requests')
    .select('id, reference_no, status')
    .eq('found_item_id', foundItemId)
    .eq('claimant_id', userId)
    .in('status', ACTIVE_CLAIM_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cancelClaim(id) {
  const { data, error } = await supabase.rpc('cancel_my_claim', { p_claim_id: id });
  if (error) throw error;
  return data;
}
