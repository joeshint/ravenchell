import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PackageCheck, PackageSearch, Plus } from 'lucide-react';
import { useItemList } from '@/hooks/useItems';
import { useAuth } from '@/hooks/useAuth';
import { PAGE_SIZE } from '@/lib/constants';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState } from '@/components/common/Feedback';
import { Pagination } from '@/components/common/Pagination';
import { ItemCard, ItemCardSkeleton } from '@/components/items/ItemCard';
import { ItemListRow } from '@/components/items/ItemListRow';
import { ItemFilters } from '@/components/items/ItemFilters';

const FILTER_KEYS = ['q', 'category', 'campus', 'status', 'from', 'to', 'sort', 'view'];

const COPY = {
  lost: {
    title: 'Lost items',
    description: 'Items reported missing by the CvSU community. Seen one of these? Report it as found.',
    icon: PackageSearch,
    cta: { to: '/report/lost', label: 'Report a lost item' },
  },
  found: {
    title: 'Found items',
    description: 'Verified items turned in on campus. If one is yours, open it and submit a claim.',
    icon: PackageCheck,
    cta: { to: '/report/found', label: 'Report a found item' },
  },
};

export default function ItemListPage({ type }) {
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const [resetKey, setResetKey] = useState(0);
  const copy = COPY[type];

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])), [params]);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const queryFilters = useMemo(() => {
    const { view: _view, ...rest } = filters;
    return { ...rest, page, pageSize: PAGE_SIZE };
  }, [filters, page]);

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useItemList(type, queryFilters);

  const updateFilters = useCallback(
    (patch, { keepPage = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
          if (!keepPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // A stale link (or items removed since) can point past the last page:
  // jump to the last page that has results instead of showing "no items".
  const lastPage = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  useEffect(() => {
    if (data && !isPlaceholderData && data.total > 0 && page > lastPage) {
      updateFilters({ page: lastPage > 1 ? String(lastPage) : '' }, { keepPage: true });
    }
  }, [data, isPlaceholderData, page, lastPage, updateFilters]);

  const resetFilters = () => {
    setParams(filters.view ? { view: filters.view } : {}, { replace: true });
    setResetKey((k) => k + 1);
  };

  const goToPage = (p) => {
    updateFilters({ page: p > 1 ? String(p) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isList = filters.view === 'list';
  const hasFilters = FILTER_KEYS.some((k) => k !== 'sort' && k !== 'view' && filters[k]);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{copy.description}</p>
        </div>
        <Button to={isAuthenticated ? copy.cta.to : '/login'} state={isAuthenticated ? undefined : { from: { pathname: copy.cta.to } }} icon={Plus}>
          {copy.cta.label}
        </Button>
      </div>

      <ItemFilters type={type} filters={filters} onChange={updateFilters} onReset={resetFilters} resetKey={resetKey} />

      <div className="mt-6" aria-live="polite" aria-busy={isPending || isPlaceholderData}>
        {isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.rows.length === 0 ? (
          <EmptyState
            icon={copy.icon}
            title={hasFilters ? 'No items match your search' : `No ${type} items listed yet`}
            description={
              hasFilters
                ? 'Try different keywords or remove some filters.'
                : 'Listings appear here after an administrator reviews them.'
            }
            action={
              hasFilters && (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <p className="mb-3 text-sm text-slate-500">
              {data.total} {data.total === 1 ? 'item' : 'items'} found
            </p>
            {isList ? (
              <ul className="space-y-3">
                {data.rows.map((item) => (
                  <ItemListRow key={item.id} item={item} type={type} />
                ))}
              </ul>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.rows.map((item) => (
                  <ItemCard key={item.id} item={item} type={type} />
                ))}
              </div>
            )}
            <Pagination className="mt-8" page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={goToPage} />
          </div>
        )}
      </div>
    </div>
  );
}
