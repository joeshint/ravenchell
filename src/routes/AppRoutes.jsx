import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { ADMIN_ROLES } from '@/lib/constants';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { UserLayout } from '@/components/layout/UserLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { FullPageSpinner } from '@/components/common/Feedback';
import { NotFoundPage, RouteErrorPage } from '@/pages/public/ErrorPages';
import { GuestOnly, RequireAuth, RequireRole } from './guards';

// Code-split pages so the public site does not download admin code.
const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const ItemListPage = lazy(() => import('@/pages/public/ItemListPage'));
const ItemDetailsPage = lazy(() => import('@/pages/public/ItemDetailsPage'));
const DashboardPage = lazy(() => import('@/pages/user/DashboardPage'));
const ReportItemPage = lazy(() => import('@/pages/user/ReportItemPage'));
const EditReportPage = lazy(() => import('@/pages/user/EditReportPage'));
const MyReportsPage = lazy(() => import('@/pages/user/MyReportsPage'));
const MyClaimsPage = lazy(() => import('@/pages/user/MyClaimsPage'));
const ClaimDetailsPage = lazy(() => import('@/pages/user/ClaimDetailsPage'));
const ClaimItemPage = lazy(() => import('@/pages/user/ClaimItemPage'));
const NotificationsPage = lazy(() => import('@/pages/user/NotificationsPage'));
const ProfilePage = lazy(() => import('@/pages/user/ProfilePage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminItemsPage = lazy(() => import('@/pages/admin/AdminItemsPage'));
const AdminClaimsPage = lazy(() => import('@/pages/admin/AdminClaimsPage'));
const AdminClaimReviewPage = lazy(() => import('@/pages/admin/AdminClaimReviewPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage'));
const AdminLocationsPage = lazy(() => import('@/pages/admin/AdminLocationsPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AdminActivityLogsPage = lazy(() => import('@/pages/admin/AdminActivityLogsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

/** `props.key` separates instances that share a component (e.g. lost vs found). */
function page(Component, props = {}) {
  const { key, ...rest } = props;
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Component key={key} {...rest} />
    </Suspense>
  );
}


export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      // ---------------------------------------------------------------- public
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: page(LandingPage) },
          { path: 'about', element: page(AboutPage) },
          { path: 'lost', element: page(ItemListPage, { key: 'lost', type: 'lost' }) },
          { path: 'lost/:id', element: page(ItemDetailsPage, { key: 'lost', type: 'lost' }) },
          { path: 'found', element: page(ItemListPage, { key: 'found', type: 'found' }) },
          { path: 'found/:id', element: page(ItemDetailsPage, { key: 'found', type: 'found' }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },

      // ------------------------------------------------------------------ auth
      {
        element: (
          <GuestOnly>
            <AuthLayout />
          </GuestOnly>
        ),
        children: [
          { path: 'login', element: page(LoginPage) },
          { path: 'register', element: page(RegisterPage) },
          { path: 'forgot-password', element: page(ForgotPasswordPage) },
        ],
      },
      {
        // Not GuestOnly: the reset link signs the user in with a recovery session.
        element: <AuthLayout />,
        children: [{ path: 'reset-password', element: page(ResetPasswordPage) }],
      },

      // ------------------------------------------------------------------ user
      {
        element: (
          <RequireAuth>
            <UserLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'dashboard', element: page(DashboardPage) },
          { path: 'report/lost', element: page(ReportItemPage, { key: 'lost', type: 'lost' }) },
          { path: 'report/found', element: page(ReportItemPage, { key: 'found', type: 'found' }) },
          { path: 'my-reports', element: page(MyReportsPage) },
          { path: 'my-reports/:type/:id/edit', element: page(EditReportPage) },
          { path: 'my-claims', element: page(MyClaimsPage) },
          { path: 'my-claims/:id', element: page(ClaimDetailsPage) },
          { path: 'found/:id/claim', element: page(ClaimItemPage) },
          { path: 'notifications', element: page(NotificationsPage) },
          { path: 'profile', element: page(ProfilePage) },
        ],
      },

      // ----------------------------------------------------------------- admin
      {
        path: 'admin',
        element: (
          <RequireAuth>
            <RequireRole roles={ADMIN_ROLES}>
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        ),
        children: [
          { index: true, element: page(AdminDashboardPage) },
          { path: 'lost-items', element: page(AdminItemsPage, { key: 'lost', type: 'lost' }) },
          { path: 'found-items', element: page(AdminItemsPage, { key: 'found', type: 'found' }) },
          { path: 'claims', element: page(AdminClaimsPage) },
          { path: 'claims/:id', element: page(AdminClaimReviewPage) },
          { path: 'users', element: page(AdminUsersPage) },
          { path: 'categories', element: page(AdminCategoriesPage) },
          { path: 'locations', element: page(AdminLocationsPage) },
          { path: 'reports', element: page(ReportsPage) },
          { path: 'activity-logs', element: page(AdminActivityLogsPage) },
          { path: 'settings', element: page(AdminSettingsPage) },
        ],
      },
    ],
  },
]);
