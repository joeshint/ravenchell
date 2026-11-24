import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Activity, ChevronDown } from 'lucide-react';
import { useAdminList } from '@/hooks/useAdmin';
import { ADMIN_PAGE_SIZE, listActivityLogs } from '@/services/admin.service';
import { ACTION_GROUPS, actionLabel, actionSubject, entityLink } from '@/utils/activity';
import { formatDateTime } from '@/utils/format';
import { PageHeader } from '@/components/common/Card';
import { Input, Select } from '@/components/common/FormControls';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { DataTable } from '@/components/admin/DataTable';

function Details({ details }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(details ?? {}).filter(([, v]) => v !== null && v !== '');
  if (!entries.length) return <span className="text-slate-400">—</span>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
      >
        {open ? 'Hide' : 'Show'} details <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <dl className="mt-2 grid max-w-md grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k.replace(/_/g, ' ')}</dt>
              <dd className="break-words text-slate-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function AdminActivityLogsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      action: params.get('action') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );
  const list = useAdminList('activity-logs', listActivityLogs, filters);

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const columns = [
    { key: 'when', header: 'When', className: 'whitespace-nowrap text-slate-500', render: (l) => formatDateTime(l.created_at) },
    {
      key: 'actor',
      header: 'Who',
      render: (l) =>
        l.actor ? (
          <div className="max-w-48">
            <p className="truncate">{l.actor.full_name}</p>
            <p className="truncate text-xs text-slate-500">{l.actor.institutional_email}</p>
          </div>
        ) : (
          <span className="text-slate-400">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (l) => (
        <div>
          <p className="text-slate-800">{actionLabel(l.action)}</p>
          <p className="font-mono text-[11px] text-slate-400">{l.action}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Record',
      render: (l) => {
        const subject = actionSubject(l);
        const link = entityLink(l);
        if (!subject) return <span className="text-slate-400">—</span>;
        return link ? (
          <Link to={link} className="font-mono text-xs text-brand-700 hover:underline">
            {subject}
          </Link>
        ) : (
          <span className="font-mono text-xs">{subject}</span>
        );
      },
    },
    { key: 'details', header: 'Details', render: (l) => <Details details={l.details} /> },
  ];

  const hasFilters = filters.action || filters.from || filters.to;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity logs"
        description="An append-only audit trail of registrations, reports, moderation, claims, role changes and settings. Entries cannot be edited or deleted."
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Type
          <Select className="mt-1 w-52" value={filters.action} onChange={(e) => update({ action: e.target.value })}>
            <option value="">All activity</option>
            {ACTION_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-slate-500">
          From
          <Input type="date" className="mt-1 w-44" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </label>
        <label className="text-xs text-slate-500">
          To
          <Input type="date" className="mt-1 w-44" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </label>
        {hasFilters && (
          <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>
      <DataTable
        caption="Activity logs"
        columns={columns}
        rows={list.data?.rows ?? []}
        isPending={list.isPending}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        dimmed={list.isPlaceholderData}
        empty={{ icon: Activity, title: 'No activity found', description: hasFilters ? 'Try a wider date range.' : 'Actions will be recorded here.' }}
      />
      {list.data && (
        <Pagination page={filters.page} pageSize={ADMIN_PAGE_SIZE} total={list.data.total} onPageChange={(p) => update({ page: p > 1 ? p : '' })} />
      )}
    </div>
  );
}
