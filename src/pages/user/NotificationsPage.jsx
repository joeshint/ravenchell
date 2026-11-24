import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from '@/hooks/useNotifications';
import { deleteNotification } from '@/services/notifications.service';
import { formatDateTime, formatRelative } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';

const STEP = 20;

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [limit, setLimit] = useState(STEP);
  const { data: unread = 0 } = useUnreadCount();
  const list = useNotificationList({ limit, unreadOnly: tab === 'unread' });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const open = (n) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates about your reports and claims."
        actions={
          <Button variant="outline" icon={CheckCheck} onClick={() => markAll.mutate()} disabled={unread === 0} loading={markAll.isPending}>
            Mark all as read
          </Button>
        }
      />
      <Tabs
        label="Notification filter"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setLimit(STEP);
        }}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: unread },
        ]}
        className="mb-5"
      />

      {list.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="You'll be notified when your reports are reviewed and when your claims change status."
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            {list.data.map((n) => (
              <li key={n.id} className={cn('flex gap-3 p-4', !n.read_at && 'bg-brand-50/40')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')} aria-hidden="true" />
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400" title={formatDateTime(n.created_at)}>
                    {formatRelative(n.created_at)}
                  </p>
                </button>
                <div className="flex shrink-0 items-start gap-1">
                  {!n.read_at && (
                    <Button variant="ghost" size="icon-sm" aria-label="Mark as read" title="Mark as read" onClick={() => markRead.mutate(n.id)}>
                      <Check className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete notification"
                    title="Delete"
                    onClick={() => remove.mutate(n.id)}
                    disabled={remove.isPending && remove.variables === n.id}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {list.data.length >= limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + STEP)} loading={list.isFetching}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
