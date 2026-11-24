import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { DEFAULT_EMAIL_DOMAINS } from '@/lib/constants';
import { getCampuses, getCategories, getLocations, getPublicSettings } from '@/services/lookups.service';

const LOOKUP_STALE = 10 * 60_000;

export function useCategories({ activeOnly = false } = {}) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategories,
    staleTime: LOOKUP_STALE,
    select: activeOnly ? (rows) => rows.filter((r) => r.is_active) : undefined,
  });
}

export function useCampuses({ activeOnly = false } = {}) {
  return useQuery({
    queryKey: queryKeys.campuses,
    queryFn: getCampuses,
    staleTime: LOOKUP_STALE,
    select: activeOnly ? (rows) => rows.filter((r) => r.is_active) : undefined,
  });
}

export function useLocations(campusId, { activeOnly = false, enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.locations(campusId),
    queryFn: () => getLocations(campusId),
    staleTime: LOOKUP_STALE,
    enabled,
    select: activeOnly ? (rows) => rows.filter((r) => r.is_active) : undefined,
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: queryKeys.publicSettings,
    queryFn: getPublicSettings,
    staleTime: LOOKUP_STALE,
  });
}

/** Allowed registration domains from settings (falls back to cvsu.edu.ph). */
export function useAllowedEmailDomains() {
  const { data } = usePublicSettings();
  const domains = data?.allowed_email_domains;
  return Array.isArray(domains) ? domains : DEFAULT_EMAIL_DOMAINS;
}
