import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider } from '@/contexts/AuthContext';
import { router } from '@/routes/AppRoutes';
import SetupRequiredPage from '@/pages/SetupRequiredPage';

export default function App() {
  if (!isSupabaseConfigured) return <SetupRequiredPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
