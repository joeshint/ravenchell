import { supabase } from '@/lib/supabase';
import { UPLOAD_LIMITS } from '@/lib/constants';

/** Returns an error message, or null if the file is acceptable for the bucket. */
export function validateFile(file, bucket) {
  const limits = UPLOAD_LIMITS[bucket];
  if (!file || !limits) return 'No file selected.';
  if (!limits.types.includes(file.type)) {
    const allowed = limits.types.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    return `Unsupported file type. Allowed: ${allowed}.`;
  }
  if (file.size > limits.maxBytes) {
    return `File is too large. Maximum size is ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`;
  }
  return null;
}

/** Public URL for a file in a public bucket (item-images, avatars). */
export function getPublicUrl(bucket, path) {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const itemImageUrl = (path) => getPublicUrl('item-images', path);
