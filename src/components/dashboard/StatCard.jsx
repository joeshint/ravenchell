import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';
import { Skeleton } from '@/components/common/Feedback';

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, to, loading }) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="mt-2 text-2xl font-semibold text-slate-900">
          {loading ? <Skeleton className="h-8 w-14" /> : formatNumber(value)}
        </div>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
    </div>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-card';
  return to ? (
    <Link to={to} className={cn(cls, 'transition-shadow hover:shadow-pop')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
