import { supabase } from '@/lib/supabase';
import { removeFile, uploadFile } from './storage.service';

/** Only columns the database lets users update (see 0004 column grants). */
export async function updateProfile(userId, values) {
  const patch = {
    full_name: values.fullName,
    department: values.department,
    user_type: values.userType,
    phone: values.phone || null,
  };
  if (values.studentEmployeeId !== undefined) patch.student_employee_id = values.studentEmployeeId;

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateAvatar(userId, file, oldPath) {
  const path = await uploadFile('avatars', file, userId);
  const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId);
  if (error) {
    await removeFile('avatars', path);
    throw error;
  }
  if (oldPath && !oldPath.startsWith('http')) await removeFile('avatars', oldPath);
  return path;
}

export async function removeAvatar(userId, oldPath) {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw error;
  if (oldPath && !oldPath.startsWith('http')) await removeFile('avatars', oldPath);
}

/** Re-checks the current password before changing it. */
export async function changePassword(email, currentPassword, newPassword) {
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new Error('Your current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getUserDashboard() {
  const { data, error } = await supabase.rpc('get_user_dashboard');
  if (error) throw error;
  return data;
}
