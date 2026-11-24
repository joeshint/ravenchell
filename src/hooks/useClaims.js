import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errors';
import { cancelClaim, getClaim, getMyActiveClaimForItem, getMyClaims, submitClaim } from '@/services/claims.service';
import { useAuth } from './useAuth';

export const claimKeys = {
  all: ['claims'],
  mine: (userId) => ['claims', 'mine', userId],
  detail: (id) => ['claims', 'detail', id],
  activeForItem: (itemId, userId) => ['claims', 'active', itemId, userId],
};

export function useMyClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: claimKeys.mine(user?.id),
    queryFn: () => getMyClaims(user.id),
    enabled: Boolean(user?.id),
  });
}

export function useClaim(id) {
  return useQuery({ queryKey: claimKeys.detail(id), queryFn: () => getClaim(id), enabled: Boolean(id) });
}

export function useMyActiveClaimForItem(itemId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: claimKeys.activeForItem(itemId, user?.id),
    queryFn: () => getMyActiveClaimForItem(itemId, user.id),
    enabled: Boolean(itemId && user?.id),
  });
}

export function useSubmitClaim() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => submitClaim({ ...input, userId: user.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelClaim,
    onSuccess: () => {
      toast.success('Your claim has been withdrawn.');
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
