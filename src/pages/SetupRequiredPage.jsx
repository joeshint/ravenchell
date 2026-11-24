import { Database } from 'lucide-react';

/** Shown instead of the app when the Supabase environment variables are missing. */
export default function SetupRequiredPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-amber-50">
          <Database className="size-6 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Connect a Supabase project</h1>
        <p className="mt-2 text-sm text-slate-600">
          The app can't start because the Supabase environment variables are missing.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{' '}
            <code className="rounded bg-slate-100 px-1">.env.local</code>.
          </li>
          <li>
            Fill in <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> from Supabase → Project Settings → API.
          </li>
          <li>Apply the database migrations (see supabase/README.md).</li>
          <li>Restart the dev server.</li>
        </ol>
      </div>
    </div>
  );
}
