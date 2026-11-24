import { useEffect, useState } from 'react';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FOUND_STATUS, LOST_STATUS } from '@/lib/constants';
import { PUBLIC_STATUSES } from '@/services/items.service';
import { useCampuses, useCategories } from '@/hooks/useLookups';
import { Input, Select } from '@/components/common/FormControls';
import { Button } from '@/components/common/Button';

/** Search box that pushes its value up after the user stops typing. */
function SearchBox({ initial, onSearch, placeholder }) {
  const [value, setValue] = useState(initial);
  const [lastSent, setLastSent] = useState(initial);
  useEffect(() => {
    if (value.trim() === lastSent.trim()) return undefined;
    const t = setTimeout(() => {
      setLastSent(value);
      onSearch(value);
    }, 400);
    return () => clearTimeout(t);
  }, [value, lastSent, onSearch]);

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        setLastSent(value);
        onSearch(value);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <label htmlFor="item-search" className="sr-only">
        Search items
      </label>
      <Input
        id="item-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        type="search"
      />
    </form>
  );
}

/**
 * filters: { q, category, campus, status, from, to, sort, view }
 * onChange(patch): merge into the URL search params (page resets).
 */
export function ItemFilters({ type, filters, onChange, onReset, resetKey = 0 }) {
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useCategories();
  const { data: campuses = [] } = useCampuses();
  const statusMap = type === 'lost' ? LOST_STATUS : FOUND_STATUS;
  const dateLabel = type === 'lost' ? 'Date lost' : 'Date found';
  const activeCount = ['category', 'campus', 'status', 'from', 'to'].filter((k) => filters[k]).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SearchBox
          key={resetKey}
          initial={filters.q ?? ''}
          onSearch={(q) => onChange({ q })}
          placeholder={`Search ${type} items by name or reference no.`}
        />
        <Button
          variant="outline"
          icon={SlidersHorizontal}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="lg:hidden"
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </Button>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <Select id="sort" value={filters.sort ?? 'newest'} onChange={(e) => onChange({ sort: e.target.value })} className="w-40">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="date">{dateLabel} (latest)</option>
          </Select>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="View">
            {[
              { v: 'grid', icon: LayoutGrid, label: 'Grid view' },
              { v: 'list', icon: List, label: 'List view' },
            ].map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ view: v === 'grid' ? '' : v }, { keepPage: true })}
                aria-pressed={(filters.view || 'grid') === v}
                aria-label={label}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md',
                  (filters.view || 'grid') === v ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100',
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-5', open ? 'grid' : 'hidden lg:grid')}>
        <div>
          <label htmlFor="f-category" className="mb-1 block text-xs font-medium text-slate-500">
            Category
          </label>
          <Select id="f-category" value={filters.category ?? ''} onChange={(e) => onChange({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-campus" className="mb-1 block text-xs font-medium text-slate-500">
            Campus
          </label>
          <Select id="f-campus" value={filters.campus ?? ''} onChange={(e) => onChange({ campus: e.target.value })}>
            <option value="">All campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-slate-500">
            Status
          </label>
          <Select id="f-status" value={filters.status ?? ''} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">All statuses</option>
            {PUBLIC_STATUSES[type].map((s) => (
              <option key={s} value={s}>
                {statusMap[s].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-slate-500">
            {dateLabel} from
          </label>
          <Input id="f-from" type="date" value={filters.from ?? ''} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-slate-500">
            {dateLabel} to
          </label>
          <Input id="f-to" type="date" value={filters.to ?? ''} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
        </div>
      </div>

      {(activeCount > 0 || filters.q) && (
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
          <X className="size-4" /> Clear all filters
        </button>
      )}
    </div>
  );
}
