import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/common/Logo';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { ScrollToTop } from './ScrollToTop';

/**
 * Sidebar layout shared by the user area and the admin area.
 * navGroups: [{ label?, items: [{ to, label, icon, end? }] }]
 */
export function AppShell({ navGroups, sidebarBadge, sidebarFooter }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-5">
        <Logo to="/" />
        {sidebarBadge}
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Sidebar">
        {navGroups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && (
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn('size-[18px]', isActive ? 'text-brand-600' : 'text-slate-400')} aria-hidden="true" />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {sidebarFooter && <div className="border-t border-slate-200 p-3">{sidebarFooter}</div>}
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <ScrollToTop />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] bg-white shadow-pop">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 -right-12 flex size-10 items-center justify-center rounded-lg bg-white text-slate-600"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
