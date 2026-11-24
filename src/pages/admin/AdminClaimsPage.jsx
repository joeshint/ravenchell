import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ClipboardCheck, Eye, Search } from 'lucide-react';
import { useAdminList } from '@/hooks/useAdmin';
import { ADMIN_PAGE_SIZE, listClaims } from '@/services/admin.service';
import { CLAIM_STATUS } from '@/lib/constants';
import { formatRelative } from '@/utils/format';
import { PageHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/FormControls';
import { Tabs } from '@/components/common/Tabs';
import { Pagination } from '@/components/common/Pagination';
import { DataTable } from '@/components/admin/DataTable';
import { ItemThumb } from '@/components/items/ItemThumb';

const TABS = [
  { value: 'pending', label: 'New' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Awaiting release' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminClaimsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      status: params.has('status') ? params.get('status') : 'pending',
      q: params.get('q') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );
  const [search, setSearch] = useState(filters.q);
  const list = useAdminList('claims', listClaims, filters);

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => {
          if (k === 'status') next.set('status', v);
          else if (v) next.set(k, String(v));
          else next.delete(k);
        });
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const columns = [
    {
      key: 'claim',
      header: 'Claim',
      render: (c) => <span className="font-mono text-xs text-slate-700">{c.reference_no}</span>,
    },
    {
      key: 'item',
      header: 'Item',
      render: (c) => (
        <div className="flex items-center gap-3">
          <ItemThumb path={c.found_item?.image_path} className="size-10" />
          <div className="min-w-0">
            <p className="max-w-52 truncate font-medium text-slate-900">{c.found_item?.item_name}</p>
            <p className="font-mono text-xs text-slate-500">{c.found_item?.reference_no}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'claimant',
      header: 'Claimant',
      render: (c) => (
        <div className="max-w-52">
          <p className="truncate">{c.claimant?.full_name}</p>
          <p className="truncate text-xs text-slate-500">
            {c.claimant?.student_employee_id} · {c.claimant?.institutional_email}
          </p>
        </div>
      ),
    },
    { key: 'submitted', header: 'Submitted', render: (c) => formatRelative(c.created_at) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge type="claim" status={c.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (c) => (
        <Button to={`/admin/claims/${c.id}`} size="sm" variant="outline" icon={Eye}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Claim requests" description="Verify ownership, decide on claims and record releases." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Tabs label="Claim status" value={filters.status} onChange={(v) => update({ status: v })} options={TABS} />
        </div>
        <form
          role="search"
          className="relative w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <label htmlFor="claim-search" className="sr-only">
            Search claims
          </label>
          <Input
            id="claim-search"
            type="search"
            className="pl-9"
            placeholder="Claim reference no. — press Enter"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value) update({ q: '' });
            }}
          />
        </form>
      </div>
      <DataTable
        caption="Claim requests"
        columns={columns}
        rows={list.data?.rows ?? []}
        isPending={list.isPending}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        dimmed={list.isPlaceholderData}
        empty={{
          icon: ClipboardCheck,
          title: `No ${CLAIM_STATUS[filters.status]?.label.toLowerCase() ?? ''} claims`,
          description: 'Claims appear here when users claim verified found items.',
        }}
      />
      {list.data && (
        <Pagination page={filters.page} pageSize={ADMIN_PAGE_SIZE} total={list.data.total} onPageChange={(p) => update({ page: p > 1 ? p : '' })} />
      )}
    </div>
  );
}
