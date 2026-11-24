import { Outlet } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ScrollToTop } from './ScrollToTop';

const POINTS = [
  'Report lost or found items in under two minutes',
  'Private verification keeps items away from false claimants',
  'Get notified the moment your claim is reviewed',
];

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <ScrollToTop />
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-800 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-brand-700/60"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-brand-900/60"
          aria-hidden="true"
        />
        <Logo light className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">
            Helping the CvSU community bring belongings back home.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-brand-100">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">Cavite State University · Lost and Found System</p>
      </aside>

      <main id="main" className="flex flex-col bg-white">
        <div className="flex h-16 items-center px-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
