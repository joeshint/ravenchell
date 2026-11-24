import { Link, useSearchParams } from 'react-router';
import { ChevronRight, ClipboardList, Search } from 'lucide-react';
import { useMyClaims } from '@/hooks/useClaims';
import { ACTIVE_CLAIM_STATUSES } from '@/services/claims.service';
import { formatDate } from '@/utils/format';
import { PageHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ItemThumb } from '@/components/items/ItemThumb';

export default function MyClaimsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'all' ? 'all' : 'active';
  const { data, isPending, isError, error, refetch } = useMyClaims();
  const active = (data ?? []).filter((c) => ACTIVE_CLAIM_STATUSES.includes(c.status));
  const rows = tab === 'active' ? active : (data ?? []);

  return (
    <div>
      <PageHeader
        title="My claims"
        description="Track the ownership claims you have submitted."
        actions={
          <Button to="/found" variant="outline" icon={Search}>
            Browse found items
          </Button>
        }
      />
      <Tabs
        label="Claim filter"
        value={tab}
        onChange={(v) => setParams(v === 'active' ? {} : { tab: v }, { replace: true })}
        options={[
          { value: 'active', label: 'Active', count: data ? active.length : undefined },
          { value: 'all', label: 'All claims', count: data?.length },
        ]}
        className="mb-5"
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'active' ? 'No active claims' : 'No claims yet'}
          description="When you find your item in the Found Items list, open it and click “Claim this item”."
          action={<Button to="/found">Browse found items</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`/my-claims/${c.id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-pop"
              >
                <ItemThumb path={c.found_item?.image_path} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{c.found_item?.item_name ?? 'Item no longer listed'}</p>
                    <StatusBadge type="claim" status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="font-mono text-xs">{c.reference_no}</span> · Submitted {formatDate(c.created_at)}
                    {c.found_item?.campus && ` · ${c.found_item.campus.name}`}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
