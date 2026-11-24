import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { FullPageSpinner, ErrorState } from '@/components/common/Feedback';
import { ForbiddenPage } from '@/pages/public/ErrorPages';

/** Signed-in users only. Remembers where the user was going. */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading, profile, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Checking your session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (profileError || !profile) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="We couldn't load your profile"
          error={profileError ?? 'Your account profile was not found. Please contact the administrator.'}
          onRetry={refreshProfile}
        />
      </div>
    );
  }
  return children ?? <Outlet />;
}

/**
 * Role gate for UI routes. This is a convenience only — the database rejects
 * admin operations from non-admins regardless of what the browser shows.
 */
export function RequireRole({ roles, children }) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <ForbiddenPage />;
  return children ?? <Outlet />;
}

/** Login/register pages: signed-in users are sent on to where they were going. */
export function GuestOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (isAuthenticated) {
    const from = location.state?.from;
    const to = from ? `${from.pathname}${from.search ?? ''}` : '/dashboard';
    return <Navigate to={to} replace />;
  }
  return children ?? <Outlet />;
}
