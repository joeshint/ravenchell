import { supabase } from '@/lib/supabase';

export async function getNotifications({ userId, limit = 20, unreadOnly = false } = {}) {
  let query = supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.is('read_at', null);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Realtime: calls `onChange` whenever this user's notifications change.
 *
 * The topic gets a unique suffix: supabase.channel(topic) returns an EXISTING
 * channel with the same topic, and adding listeners to an already-subscribed
 * channel throws ("cannot add postgres_changes callbacks … after subscribe()").
 * removeChannel() is async, so a quick remount could otherwise reuse a channel
 * that is still closing. Call this from ONE place only (see AuthProvider).
 */
export function subscribeToNotifications(userId, onChange) {
  const channel = supabase
    .channel(`notifications:${userId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
