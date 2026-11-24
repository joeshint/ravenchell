import { STATUS_MAPS } from '@/lib/constants';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/common/Feedback';

const DOT = {
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  brand: 'bg-brand-600',
  slate: 'bg-slate-400',
};

/** Vertical timeline of item_status_history rows. `type`: lost | found | claim. */
export function StatusTimeline({ type, history, isPending }) {
  if (isPending) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-3 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!history?.length) return <p className="text-sm text-slate-500">No status changes recorded yet.</p>;

  return (
    <ol className="relative space-y-5">
      {history.map((h, i) => {
        const meta = STATUS_MAPS[type]?.[h.to_status] ?? { label: h.to_status, tone: 'slate' };
        const last = i === history.length - 1;
        return (
          <li key={h.id} className="relative flex gap-3">
            {!last && <span className="absolute top-4 left-[5px] h-[calc(100%+0.25rem)] w-px bg-slate-200" aria-hidden="true" />}
            <span className={cn('relative mt-1 size-3 shrink-0 rounded-full ring-4 ring-white', DOT[meta.tone])} aria-hidden="true" />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', last ? 'text-slate-900' : 'text-slate-700')}>{meta.label}</p>
              <p className="text-xs text-slate-500">{formatDateTime(h.created_at)}</p>
              {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">{h.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
