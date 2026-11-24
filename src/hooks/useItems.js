import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errors';
import {
  deleteReport,
  getItem,
  getItemPrivate,
  getMyReports,
  getStatusHistory,
  listItems,
  markLostItemRecovered,
  saveReport,
} from '@/services/items.service';
import { useAuth } from './useAuth';

export const itemKeys = {
  all: ['items'],
  list: (type, filters) => ['items', type, 'list', filters],
  detail: (type, id) => ['items', type, 'detail', id],
  private: (type, id) => ['items', type, 'private', id],
  mine: (type, userId) => ['items', type, 'mine', userId],
  history: (entityType, id) => ['history', entityType, id],
};

export function useItemList(type, filters) {
  return useQuery({
    queryKey: itemKeys.list(type, filters),
    queryFn: () => listItems(type, filters),
    placeholderData: keepPreviousData,
  });
}

export function useItem(type, id) {
  return useQuery({
    queryKey: itemKeys.detail(type, id),
    queryFn: () => getItem(type, id),
    enabled: Boolean(id),
  });
}

export function useItemPrivate(type, id, enabled) {
  return useQuery({
    queryKey: itemKeys.private(type, id),
    queryFn: () => getItemPrivate(type, id),
    enabled: Boolean(id) && enabled,
  });
}

export function useStatusHistory(entityType, id, enabled = true) {
  return useQuery({
    queryKey: itemKeys.history(entityType, id),
    queryFn: () => getStatusHistory(entityType, id),
    enabled: Boolean(id) && enabled,
  });
}

export function useMyReports(type) {
  const { user } = useAuth();
  return useQuery({
    queryKey: itemKeys.mine(type, user?.id),
    queryFn: () => getMyReports(type, user.id),
    enabled: Boolean(user?.id),
  });
}

function useInvalidateItems() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: itemKeys.all });
    queryClient.invalidateQueries({ queryKey: ['history'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
}

/** Create or update a report (see saveReport for the photo handling). */
export function useSaveReport(type) {
  const { user } = useAuth();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: ({ id, values, image, existingPath }) =>
      saveReport({ type, id, values, image, existingPath, userId: user.id }),
    onSuccess: invalidate,
  });
}

export function useDeleteReport(type) {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: (item) => deleteReport(type, item),
    onSuccess: () => {
      toast.success('Report deleted.');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useMarkLostRecovered() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: markLostItemRecovered,
    onSuccess: () => {
      toast.success('Great news! Your report is marked as recovered.');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
