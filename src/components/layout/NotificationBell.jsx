import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/format';
import { useClickOutside } from '@/hooks/useClickOutside';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from '@/hooks/useNotifications';
import { Skeleton } from '@/components/common/Feedback';

export function NotificationBell({ className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const { data: unread = 0 } = useUnreadCount();
  const list = useNotificationList({ limit: 8, enabled: open });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const openNotification = (n) => {
    if (!n.read_at) markRead.mutate(n.id);
    setOpen(false);
    navigate(n.link || '/notifications');
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={unread === 0 || markAll.isPending}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.isPending ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : list.isError ? (
              <p className="p-4 text-sm text-red-600">Could not load notifications.</p>
            ) : list.data.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 size-6 text-slate-300" />
                <p className="text-sm text-slate-500">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50',
                        !n.read_at && 'bg-brand-50/50',
                      )}
                    >
                      <span
                        className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400">{formatRelative(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
