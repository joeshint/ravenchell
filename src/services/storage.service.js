import { supabase } from '@/lib/supabase';
import { validateFile } from '@/utils/storage';

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Uploads into `<bucket>/<userId>/<random>.<ext>` — the folder layout the
 * storage policies require. Returns the object path.
 */
export async function uploadFile(bucket, file, userId) {
  const problem = validateFile(file, bucket);
  if (problem) throw new Error(problem);
  if (!userId) throw new Error('You must be signed in to upload files.');

  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Best-effort delete (used for cleanup); never throws. */
export async function removeFile(bucket, path) {
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // An orphaned file is harmless; don't fail the user's action over it.
  }
}

/** Short-lived URL for private buckets (claim evidence). */
export async function getSignedUrl(bucket, path, expiresIn = 300) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
