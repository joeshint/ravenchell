import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  FileSearch,
  PackageCheck,
  PackageSearch,
  Search,
  Undo2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMyReports } from '@/hooks/useItems';
import { useMyClaims } from '@/hooks/useClaims';
import { useNotificationList } from '@/hooks/useNotifications';
import { getUserDashboard } from '@/services/profile.service';
import { formatDate, formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ErrorState, Skeleton } from '@/components/common/Feedback';
import { StatCard } from '@/components/dashboard/StatCard';
import { ItemThumb } from '@/components/items/ItemThumb';

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentReports() {
  const lost = useMyReports('lost');
  const found = useMyReports('found');
  if (lost.isPending || found.isPending) return <ListSkeleton />;
  if (lost.isError || found.isError) {
    return <ErrorState className="m-5" error={lost.error ?? found.error} onRetry={() => (lost.refetch(), found.refetch())} />;
  }
  const rows = [
    ...lost.data.map((r) => ({ ...r, type: 'lost' })),
    ...found.data.map((r) => ({ ...r, type: 'found' })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  if (!rows.length) {
    return (
      <div className="px-5 py-10 text-center text-sm text-slate-500">
        You haven't reported anything yet.
        <div className="mt-3 flex justify-center gap-2">
          <Button to="/report/lost" size="sm" variant="outline">
            Report lost
          </Button>
          <Button to="/report/found" size="sm">
            Report found
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={`${r.type}-${r.id}`}>
          <Link to={`/${r.type}/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
            <ItemThumb path={r.image_path} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{r.item_name}</p>
              <p className="text-xs text-slate-500">
                {r.type === 'lost' ? 'Lost' : 'Found'} · {r.reference_no} · {formatDate(r.created_at)}
              </p>
            </div>
            <StatusBadge type={r.type} status={r.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentClaims() {
  const { data, isPending, isError, error, refetch } = useMyClaims();
  if (isPending) return <ListSkeleton />;
  if (isError) return <ErrorState className="m-5" error={error} onRetry={refetch} />;
  if (!data.length) {
    return (
      <div className="px-5 py-10 text-center text-sm text-slate-500">
        No claims yet. Found your item in the listings? Open it and click “Claim this item”.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {data.slice(0, 5).map((c) => (
        <li key={c.id}>
          <Link to={`/my-claims/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
            <ItemThumb path={c.found_item?.image_path} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{c.found_item?.item_name ?? 'Item'}</p>
              <p className="text-xs text-slate-500">
                {c.reference_no} · {formatDate(c.created_at)}
              </p>
            </div>
            <StatusBadge type="claim" status={c.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentNotifications() {
  const { data, isPending, isError, error, refetch } = useNotificationList({ limit: 5 });
  if (isPending) return <ListSkeleton />;
  if (isError) return <ErrorState className="m-5" error={error} onRetry={refetch} />;
  if (!data.length) return <p className="px-5 py-10 text-center text-sm text-slate-500">No activity yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {data.map((n) => (
        <li key={n.id} className="flex gap-3 px-5 py-3">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-slate-200' : 'bg-brand-600')} aria-hidden="true" />
          <div className="min-w-0">
            {n.link ? (
              <Link to={n.link} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                {n.title}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-900">{n.title}</p>
            )}
            {n.body && <p className="line-clamp-2 text-xs text-slate-500">{n.body}</p>}
            <p className="mt-0.5 text-[11px] text-slate-400">{formatRelative(n.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const stats = useQuery({ queryKey: ['dashboard', user?.id], queryFn: getUserDashboard });
  const s = stats.data;
  const g = s?.global;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {greeting()}, {profile?.full_name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your reports and claims.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button to="/report/lost" variant="outline" icon={FileSearch}>
            Report lost
          </Button>
          <Button to="/report/found" icon={PackageCheck}>
            Report found
          </Button>
        </div>
      </div>

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="My open lost reports" value={s?.my_lost_open} hint={s && `${s.my_lost} reported in total`} icon={FileSearch} tone="red" to="/my-reports" loading={stats.isPending} />
            <StatCard label="Items I turned in" value={s?.my_found} hint={s && `${s.my_found_returned} returned to owners`} icon={PackageCheck} to="/my-reports?tab=found" loading={stats.isPending} />
            <StatCard label="Pending claims" value={s?.my_claims_pending} hint={s && `${s.my_claims_approved} approved, awaiting pickup`} icon={ClipboardList} tone="amber" to="/my-claims" loading={stats.isPending} />
            <StatCard label="Unread notifications" value={s?.unread_notifications} icon={Bell} tone="blue" to="/notifications" loading={stats.isPending} />
          </div>

          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Lost items still missing', value: g?.lost_open, icon: PackageSearch, to: '/lost?status=approved' },
                { label: 'Found items awaiting owners', value: g?.found_available, icon: Search, to: '/found?status=verified' },
                { label: 'Items returned across CvSU', value: g?.returned, icon: Undo2, to: '/found?status=released' },
              ].map(({ label, value, icon: Icon, to }) => (
                <Link key={label} to={to} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold text-slate-900">
                      {stats.isPending ? <Skeleton className="h-6 w-10" /> : value}
                    </span>
                    <span className="block text-xs text-slate-500">{label}</span>
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="My recent reports"
            action={
              <Link to="/my-reports" className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800">
                View all <ChevronRight className="size-4" />
              </Link>
            }
          />
          <RecentReports />
        </Card>
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link to="/notifications" className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800">
                All <ChevronRight className="size-4" />
              </Link>
            }
          />
          <RecentNotifications />
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader
            title="My recent claims"
            action={
              <Link to="/my-claims?tab=all" className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800">
                View all <ChevronRight className="size-4" />
              </Link>
            }
          />
          <RecentClaims />
        </Card>
      </div>
    </div>
  );
}
