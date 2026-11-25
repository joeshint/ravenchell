import { createClient } from '@supabase/supabase-js';

/**
 * Env values pasted from a browser, chat or document often carry invisible
 * characters (BOM, zero-width or non-breaking spaces) or smart quotes. The key
 * is sent as an HTTP header, and fetch() throws "String contains non ISO-8859-1
 * code point" on any of them, so strip them here.
 */
function cleanEnv(value) {
  return (value ?? '')
    .replace(/[\uFEFF\u200B-\u200D\u2060\u00A0]/g, '')
    .trim()
    .replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/g, '');
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Anything left outside printable ASCII would still break every request.
const isAscii = (s) => /^[\x21-\x7E]*$/.test(s);

/** Explains a malformed (not missing) env value, or null. */
export const supabaseConfigError =
  supabaseUrl && supabaseAnonKey && !(isAscii(supabaseUrl) && isAscii(supabaseAnonKey))
    ? `${isAscii(supabaseUrl) ? 'VITE_SUPABASE_ANON_KEY' : 'VITE_SUPABASE_URL'} in .env.local contains an invalid character (for example a "…", a smart quote or a space). Copy it again from Supabase → Project Settings → API.`
    : null;

/** False when `.env.local` is missing or malformed; the app then shows a setup screen. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !supabaseConfigError;

/**
 * The single Supabase client for the browser. It only ever holds the public
 * anon/publishable key — every permission is enforced by RLS in the database.
 */
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'public-anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    // TanStack Query already retries failed queries; avoid stacking two retry layers.
    db: { retry: false },
  },
);
