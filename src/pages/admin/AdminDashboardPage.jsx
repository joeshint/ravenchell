import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardCheck, FileSearch, PackageCheck, Undo2, Users } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAdmin';
import { listActivityLogs, listAdminItems, listClaims } from '@/services/admin.service';
import { actionLabel, actionSubject, entityLink } from '@/utils/activity';
import { formatRelative } from '@/utils/format';
import { Card, CardHeader, PageHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ErrorState, Skeleton } from '@/components/common/Feedback';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartCard, GroupedBars, TrendChart } from '@/components/dashboard/Charts';
import { ItemThumb } from '@/components/items/ItemThumb';

function QueueList({ title, to, query, render }) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Link to={to} className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800">
            Open queue <ChevronRight className="size-4" />
          </Link>
        }
      />
      {query.isPending ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState className="m-5" error={query.error} onRetry={query.refetch} />
      ) : query.data.rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing waiting. 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-100">{query.data.rows.slice(0, 5).map(render)}</ul>
      )}
    </Card>
  );
}

export default function AdminDashboardPage() {
  const analytics = useAnalytics();
  const t = analytics.data?.totals;
  const pendingLost = useQuery({ queryKey: ['admin', 'queue', 'lost'], queryFn: () => listAdminItems('lost', { status: 'pending' }) });
  const pendingFound = useQuery({
    queryKey: ['admin', 'queue', 'found'],
    queryFn: () => listAdminItems('found', { status: 'pending_verification' }),
  });
  const pendingClaims = useQuery({ queryKey: ['admin', 'queue', 'claims'], queryFn: () => listClaims({ status: 'pending' }) });
  const logs = useQuery({ queryKey: ['admin', 'recent-logs'], queryFn: () => listActivityLogs({ pageSize: 8 }) });

  const itemRow = (type) => (item) => (
    <li key={item.id}>
      <Link
        to={`/admin/${type}-items?ref=${item.reference_no}`}
        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
      >
        <ItemThumb path={item.image_path} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{item.item_name}</p>
          <p className="text-xs text-slate-500">
            {item.reference_no} · {item.reporter?.full_name} · {formatRelative(item.created_at)}
          </p>
        </div>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin dashboard"
        description="Overview of reports, claims and activity across all campuses."
        actions={
          <Button to="/admin/reports" variant="outline">
            Full analytics
          </Button>
        }
      />

      {analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={analytics.refetch} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Lost reports to review" value={t?.lost_pending} hint={t && `${t.lost_total} lost reports in total`} icon={FileSearch} tone="amber" to="/admin/lost-items?status=pending" loading={analytics.isPending} />
          <StatCard label="Found items to verify" value={t?.found_pending} hint={t && `${t.found_total} found reports in total`} icon={PackageCheck} tone="amber" to="/admin/found-items?status=pending_verification" loading={analytics.isPending} />
          <StatCard label="Claims awaiting decision" value={t && t.claims_pending + t.claims_under_review} hint={t && `${t.claims_under_review} under review`} icon={ClipboardCheck} tone="blue" to="/admin/claims?status=pending" loading={analytics.isPending} />
          <StatCard label="Items returned" value={t?.returned} hint={t && `${t.found_claimed} approved, awaiting pickup`} icon={Undo2} to="/admin/claims?status=approved" loading={analytics.isPending} />
          <StatCard label="Registered users" value={t?.users_total} hint={t && `${t.users_active} active`} icon={Users} tone="slate" to="/admin/users" loading={analytics.isPending} />
        </div>
      )}

      {analytics.data && (
        <div className="grid gap-6 xl:grid-cols-5">
          <ChartCard
            className="xl:col-span-3"
            title="Reports per month"
            description="New lost and found reports, and items returned, over the last 12 months."
            seriesKeys={['lost', 'found', 'returned']}
            table={{
              columns: [
                { key: 'month', header: 'Month' },
                { key: 'lost', header: 'Lost', numeric: true },
                { key: 'found', header: 'Found', numeric: true },
                { key: 'returned', header: 'Returned', numeric: true },
              ],
              rows: analytics.data.monthly,
            }}
          >
            <TrendChart data={analytics.data.monthly} />
          </ChartCard>
          <ChartCard
            className="xl:col-span-2"
            title="Reports by category"
            description="All-time lost and found reports."
            seriesKeys={['lost', 'found']}
            table={{
              columns: [
                { key: 'name', header: 'Category' },
                { key: 'lost', header: 'Lost', numeric: true },
                { key: 'found', header: 'Found', numeric: true },
              ],
              rows: analytics.data.by_category,
            }}
          >
            <GroupedBars data={analytics.data.by_category} labelWidth={140} />
          </ChartCard>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <QueueList title="Lost reports to review" to="/admin/lost-items?status=pending" query={pendingLost} render={itemRow('lost')} />
        <QueueList title="Found items to verify" to="/admin/found-items?status=pending_verification" query={pendingFound} render={itemRow('found')} />
        <QueueList
          title="New claims"
          to="/admin/claims?status=pending"
          query={pendingClaims}
          render={(c) => (
            <li key={c.id}>
              <Link to={`/admin/claims/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <ItemThumb path={c.found_item?.image_path} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.found_item?.item_name}</p>
                  <p className="text-xs text-slate-500">
                    {c.reference_no} · {c.claimant?.full_name} · {formatRelative(c.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          )}
        />
      </div>

      <Card>
        <CardHeader
          title="Recent activity"
          action={
            <Link to="/admin/activity-logs" className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800">
              All logs <ChevronRight className="size-4" />
            </Link>
          }
        />
        {logs.isPending ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : logs.isError ? (
          <ErrorState className="m-5" error={logs.error} onRetry={logs.refetch} />
        ) : logs.data.rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.data.rows.map((log) => {
              const link = entityLink(log);
              const subject = actionSubject(log);
              return (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="text-slate-700">
                    <span className="font-medium text-slate-900">{log.actor?.full_name ?? 'System'}</span> ·{' '}
                    {actionLabel(log.action).toLowerCase()}
                    {subject &&
                      (link ? (
                        <Link to={link} className="ml-1 font-mono text-xs text-brand-700 hover:underline">
                          {subject}
                        </Link>
                      ) : (
                        <span className="ml-1 font-mono text-xs text-slate-500">{subject}</span>
                      ))}
                    {log.details?.to && <StatusBadgeFor log={log} />}
                  </span>
                  <span className="text-xs text-slate-400">{formatRelative(log.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadgeFor({ log }) {
  const type = { lost_item: 'lost', found_item: 'found', claim: 'claim' }[log.entity_type];
  if (!type) return null;
  return <StatusBadge type={type} status={log.details.to} className="ml-2" />;
}
