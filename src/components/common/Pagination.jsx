import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…' + p);
    out.push(p);
  });
  return out;
}

/** 1-based pagination with a "Showing x–y of z" summary. */
export function Pagination({ page, pageSize, total, onPageChange, className }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Past the last page (stale link, or rows removed since): move to the last one.
  const outOfRange = total > 0 && page > totalPages;
  useEffect(() => {
    if (outOfRange) onPageChange(totalPages);
  }, [outOfRange, totalPages, onPageChange]);

  if (total === 0 || outOfRange) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    'h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(btn, 'inline-flex border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, totalPages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="hidden px-1 text-slate-400 sm:inline">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                btn,
                'hidden sm:inline-flex',
                p === page
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {p}
            </button>
          ),
        )}
        <span className="px-2 text-sm text-slate-500 sm:hidden">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className={cn(btn, 'inline-flex border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
