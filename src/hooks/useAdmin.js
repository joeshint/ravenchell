import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errors';
import { getAnalytics } from '@/services/admin.service';

/** Paginated admin list keyed under ['admin', name, params]. */
export function useAdminList(name, fetcher, params) {
  return useQuery({
    queryKey: ['admin', name, params],
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
  });
}

export function useAnalytics(from, to) {
  return useQuery({
    queryKey: ['admin', 'analytics', from ?? null, to ?? null],
    queryFn: () => getAnalytics(from, to),
  });
}

/**
 * Mutation for admin actions: on success shows `successMessage` (string or
 * fn(result, variables)) and refreshes every cached query that could change.
 * Errors are toasted unless the caller handles them (pass `silentError`).
 */
export function useAdminMutation(mutationFn, { successMessage, silentError = false, onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      const msg = typeof successMessage === 'function' ? successMessage(result, variables) : successMessage;
      if (msg) toast.success(msg);
      ['admin', 'items', 'claims', 'history', 'lookups', 'settings', 'stats', 'dashboard', 'notifications'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      );
      onSuccess?.(result, variables);
    },
    onError: (err) => {
      if (!silentError) toast.error(getErrorMessage(err));
    },
  });
}
