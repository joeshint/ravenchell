import { cn } from '@/utils/cn';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';

/**
 * Simple accessible table. columns: [{ key, header, render?(row), className?, headerClassName? }]
 * Wide tables scroll horizontally inside their card, never the page.
 */
export function DataTable({ columns, rows, isPending, isError, error, onRetry, empty, rowKey = 'id', dimmed = false, caption }) {
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className={cn('w-full min-w-[720px] text-left text-sm', dimmed && 'opacity-60 transition-opacity')}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 whitespace-nowrap', c.headerClassName)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row[rowKey]} className="hover:bg-slate-50/70">
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4 py-3 align-middle text-slate-700', c.className)}>
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!isPending && rows.length === 0 && (
        <div className="p-4">
          <EmptyState className="border-0 bg-transparent" {...empty} />
        </div>
      )}
    </div>
  );
}
