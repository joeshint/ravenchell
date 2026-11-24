import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { ADMIN_ROLES } from '@/lib/constants';
import { fetchProfile, signOut as signOutRequest } from '@/services/auth.service';
import { useNotificationsRealtime } from '@/hooks/useNotifications';
import { AuthContext } from './auth-context';

/**
 * Holds the Supabase session and the user's profile (including role).
 * The role here only drives the UI; the database enforces every permission.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });

    // Note: no Supabase calls inside this callback (supabase-js deadlock caveat);
    // the profile is loaded by the query below when the user id changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setInitializing(false);
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      if (event === 'SIGNED_OUT') {
        setIsRecovery(false);
        queryClient.removeQueries({ queryKey: ['profile'] });
        queryClient.removeQueries({ queryKey: ['notifications'] });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user?.id ?? null;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => fetchProfile(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  const profile = userId ? (profileQuery.data ?? null) : null;

  // The single app-wide Realtime subscription for notifications.
  useNotificationsRealtime(userId);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } catch {
      // Even if the network call fails, clear the local session.
      await supabase.auth.signOut({ scope: 'local' });
    }
  }, []);

  // Accounts deactivated by an administrator are signed out immediately.
  useEffect(() => {
    if (profile && !profile.is_active) {
      toast.error('Your account has been deactivated. Please contact the Office of Student Affairs.');
      signOut();
    }
  }, [profile, signOut]);

  const refreshProfile = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
    [queryClient, userId],
  );
  const clearRecovery = useCallback(() => setIsRecovery(false), []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAuthenticated: Boolean(session),
      isAdmin: ADMIN_ROLES.includes(profile?.role),
      isSuperAdmin: profile?.role === 'super_admin',
      loading: initializing || (Boolean(userId) && profileQuery.isPending),
      profileError: profileQuery.error,
      isRecovery,
      clearRecovery,
      refreshProfile,
      signOut,
    }),
    [session, profile, initializing, userId, profileQuery.isPending, profileQuery.error, isRecovery, clearRecovery, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
