import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ROLES } from '@/lib/constants';
import { Avatar } from '@/components/common/Avatar';

export function UserMenu() {
  const { profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  if (!profile) return null;

  const handleSignOut = async () => {
    close();
    await signOut();
    toast.success('You have been signed out.');
    navigate('/', { replace: true });
  };

  const itemClass = 'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
        <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 md:block">
          {profile.full_name.split(' ')[0]}
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 md:block" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
          <div className="border-b border-slate-100 px-3 pt-2 pb-3">
            <p className="truncate text-sm font-semibold text-slate-900">{profile.full_name}</p>
            <p className="truncate text-xs text-slate-500">{profile.institutional_email}</p>
            {profile.role !== 'user' && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                <ShieldCheck className="size-3" />
                {ROLES[profile.role]}
              </p>
            )}
          </div>
          <div className="py-1">
            <Link to="/dashboard" onClick={close} className={itemClass}>
              <LayoutDashboard className="size-4 text-slate-400" /> Dashboard
            </Link>
            <Link to="/profile" onClick={close} className={itemClass}>
              <UserRound className="size-4 text-slate-400" /> Profile settings
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={close} className={itemClass}>
                <ShieldCheck className="size-4 text-slate-400" /> Admin panel
              </Link>
            )}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button type="button" onClick={handleSignOut} className={`${itemClass} text-red-600 hover:bg-red-50`}>
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
