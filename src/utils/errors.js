/**
 * Turn Supabase / Postgres / network errors into messages a user can act on.
 * The database raises friendly messages itself (see 0003/0005 migrations), so
 * those are passed through; only technical errors are rewritten.
 */
const CONSTRAINT_MESSAGES = {
  claim_requests_one_active_per_user: 'You already have an active claim for this item.',
  claim_requests_one_winner_per_item: 'Another claim for this item has already been approved.',
  profiles_email_key: 'An account with this email already exists.',
  profiles_student_id_key: 'This Student/Employee ID is already registered.',
  item_categories_name_key: 'A category with this name already exists.',
  item_categories_slug_key: 'A category with this slug already exists.',
  campuses_name_key: 'A campus with this name already exists.',
  campuses_code_key: 'A campus with this code already exists.',
  campus_locations_campus_name_key: 'This campus already has a location with that name.',
};

const AUTH_MESSAGES = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed': 'Please confirm your email address first. Check your inbox for the confirmation link.',
  'User already registered': 'An account with this email already exists.',
  'Database error saving new user':
    'Registration failed. Make sure you are using your CvSU email and that your ID is not already registered.',
  'New password should be different from the old password.': 'Your new password must be different from the old one.',
};

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const message = error.message ?? '';
  const code = error.code ?? '';

  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)) {
    return 'Cannot reach the server. Check your internet connection and try again.';
  }

  for (const [key, friendly] of Object.entries(AUTH_MESSAGES)) {
    if (message.includes(key)) return friendly;
  }

  if (code === '23505') {
    const match = Object.keys(CONSTRAINT_MESSAGES).find(
      (name) => message.includes(name) || error.details?.includes(name),
    );
    return match ? CONSTRAINT_MESSAGES[match] : 'This record already exists.';
  }
  if (code === '23503') {
    return message.includes('violates foreign key')
      ? 'This record is still in use and cannot be removed.'
      : message;
  }
  if (code === '42501') {
    if (message.startsWith('permission denied') || message.includes('row-level security')) {
      return 'You do not have permission to do that.';
    }
    return message;
  }
  if (code === 'PGRST116') return 'The requested record was not found.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a few minutes and try again.';

  // Our own RAISE EXCEPTION messages (P0002, 22023, 23514, ...) are already user-facing.
  return message || fallback;
}
