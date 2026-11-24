import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry permission / validation errors from Postgres.
        const code = error?.code ?? '';
        if (['42501', 'PGRST301', 'P0002', '22023', '23514'].includes(code)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Centralised query keys so invalidation stays consistent. */
export const queryKeys = {
  profile: (userId) => ['profile', userId],
  categories: ['lookups', 'categories'],
  campuses: ['lookups', 'campuses'],
  locations: (campusId) => ['lookups', 'locations', campusId ?? 'all'],
  publicSettings: ['settings', 'public'],
  publicStats: ['stats', 'public'],
  recentItems: (type) => ['items', type, 'recent'],
  notifications: (userId) => ['notifications', userId],
  unreadCount: (userId) => ['notifications', userId, 'unread'],
};
