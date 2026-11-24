import { supabase } from '@/lib/supabase';

const origin = () => window.location.origin;

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Registers a user. Profile fields travel as user metadata and are copied into
 * `profiles` by the `handle_new_user` trigger, which always assigns role 'user'.
 * Returns { needsEmailConfirmation } so the UI can show the right next step.
 */
export async function signUp({ fullName, studentEmployeeId, email, department, userType, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${origin()}/login`,
      data: {
        full_name: fullName.trim(),
        student_employee_id: studentEmployeeId.trim(),
        department: department.trim(),
        user_type: userType,
      },
    },
  });
  if (error) throw error;
  return { user: data.user, needsEmailConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin()}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** { email_taken, student_id_taken } — lets the form explain conflicts clearly. */
export async function checkRegistrationAvailability(email, studentId) {
  const { data, error } = await supabase.rpc('check_registration_availability', {
    p_email: email,
    p_student_id: studentId,
  });
  if (error) throw error;
  return data;
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
