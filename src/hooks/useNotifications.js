import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryClient';
import { getErrorMessage } from '@/utils/errors';
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '@/services/notifications.service';
import { useAuth } from './useAuth';

/**
 * Live updates for the signed-in user's notifications. Must be mounted exactly
 * once (it is, in AuthProvider) — never inside components that can appear
 * several times on a page, like the bell and the Notifications page.
 */
export function useNotificationsRealtime(userId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return undefined;
    return subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    });
  }, [userId, queryClient]);
}

/** Unread count (kept live by useNotificationsRealtime). */
export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.unreadCount(userId),
    queryFn: () => getUnreadCount(userId),
    enabled: Boolean(userId),
    // Fallback polling in case Realtime is not enabled on the project.
    refetchInterval: 60_000,
  });
}

export function useNotificationList({ limit = 20, unreadOnly = false, enabled = true } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: [...queryKeys.notifications(userId), { limit, unreadOnly }],
    queryFn: () => getNotifications({ userId, limit, unreadOnly }),
    enabled: Boolean(userId) && enabled,
    // Keep showing the current list while "Load more" fetches a longer one.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey?.[2]?.unreadOnly === unreadOnly ? previous : undefined,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
