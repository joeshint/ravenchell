import { useState } from 'react';
import { NavLink } from 'react-router';
import { Menu, Plus, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/common/Button';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/lost', label: 'Lost Items' },
  { to: '/found', label: 'Found Items' },
  { to: '/about', label: 'About' },
];

export function Navbar() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <>
              <span className="hidden sm:block">
                <Button to="/report/lost" size="sm" icon={Plus}>
                  Report item
                </Button>
              </span>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button to="/register" size="sm">
                Create account
              </Button>
            </div>
          )}
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white md:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col gap-1 py-3">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setMobileOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            {isAuthenticated ? (
              <Button to="/report/lost" icon={Plus} className="mt-2" onClick={() => setMobileOpen(false)}>
                Report an item
              </Button>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button to="/login" variant="outline" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Button>
                <Button to="/register" onClick={() => setMobileOpen(false)}>
                  Create account
                </Button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
