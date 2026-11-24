import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Eye, FileSearch, PackageCheck, Search } from 'lucide-react';
import { useAdminList } from '@/hooks/useAdmin';
import { useCampuses, useCategories } from '@/hooks/useLookups';
import { ADMIN_PAGE_SIZE, listAdminItems } from '@/services/admin.service';
import { FOUND_STATUS, LOST_STATUS } from '@/lib/constants';
import { formatDate, formatRelative } from '@/utils/format';
import { PageHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input, Select } from '@/components/common/FormControls';
import { Pagination } from '@/components/common/Pagination';
import { DataTable } from '@/components/admin/DataTable';
import { ItemReviewModal } from '@/components/admin/ItemReviewModal';
import { ItemThumb } from '@/components/items/ItemThumb';

const COPY = {
  lost: { title: 'Lost items', description: 'Approve, reject, resolve or archive lost-item reports.', icon: FileSearch, statuses: LOST_STATUS },
  found: { title: 'Found items', description: 'Verify found items before they are listed, and manage their lifecycle.', icon: PackageCheck, statuses: FOUND_STATUS },
};

export default function AdminItemsPage({ type }) {
  const copy = COPY[type];
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const { data: campuses = [] } = useCampuses();
  const { data: categories = [] } = useCategories();

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? params.get('ref') ?? '',
      status: params.get('status') ?? '',
      campus: params.get('campus') ?? '',
      category: params.get('category') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );
  const [search, setSearch] = useState(filters.q);
  const list = useAdminList(`${type}-items`, (p) => listAdminItems(type, p), filters);

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('ref');
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  // Keep the open item in sync with refreshed list data (status changes after an action).
  const current = selected ? (list.data?.rows.find((r) => r.id === selected.id) ?? selected) : null;

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (r) => (
        <div className="flex items-center gap-3">
          <ItemThumb path={r.image_path} className="size-10" />
          <div className="min-w-0">
            <p className="max-w-56 truncate font-medium text-slate-900">{r.item_name}</p>
            <p className="font-mono text-xs text-slate-500">{r.reference_no}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => r.category?.name },
    { key: 'campus', header: 'Campus', render: (r) => <span title={r.campus?.name}>{r.campus?.code}</span> },
    {
      key: 'reporter',
      header: type === 'lost' ? 'Reporter' : 'Finder',
      render: (r) => (
        <div className="max-w-48">
          <p className="truncate">{r.reporter?.full_name}</p>
          <p className="truncate text-xs text-slate-500">{r.reporter?.institutional_email}</p>
        </div>
      ),
    },
    { key: 'date', header: type === 'lost' ? 'Date lost' : 'Date found', render: (r) => formatDate(type === 'lost' ? r.date_lost : r.date_found) },
    { key: 'submitted', header: 'Submitted', render: (r) => <span title={r.created_at}>{formatRelative(r.created_at)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge type={type} status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) => (
        <Button size="sm" variant="outline" icon={Eye} onClick={() => setSelected(r)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={copy.title} description={copy.description} />

      <div className="flex flex-wrap gap-2">
        <form
          role="search"
          className="relative min-w-60 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <label htmlFor="admin-item-search" className="sr-only">
            Search
          </label>
          <Input
            id="admin-item-search"
            type="search"
            className="pl-9"
            placeholder="Item name or reference no. — press Enter"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value) update({ q: '' });
            }}
          />
        </form>
        <Select aria-label="Status" className="w-48" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(copy.statuses).map(([v, m]) => (
            <option key={v} value={v}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Campus" className="w-44" value={filters.campus} onChange={(e) => update({ campus: e.target.value })}>
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Category" className="w-48" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        caption={copy.title}
        columns={columns}
        rows={list.data?.rows ?? []}
        isPending={list.isPending}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        dimmed={list.isPlaceholderData}
        empty={{ icon: copy.icon, title: 'No reports found', description: 'Try a different status or search.' }}
      />
      {list.data && (
        <Pagination page={filters.page} pageSize={ADMIN_PAGE_SIZE} total={list.data.total} onPageChange={(p) => update({ page: p > 1 ? p : '' })} />
      )}

      {current && <ItemReviewModal key={current.id} type={type} item={current} onClose={() => setSelected(null)} />}
    </div>
  );
}
