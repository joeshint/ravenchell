import { cn } from '@/utils/cn';
import { STATUS_MAPS } from '@/lib/constants';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  gold: 'bg-accent-100 text-accent-600 ring-accent-300',
};

export function Badge({ tone = 'slate', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone] ?? TONES.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** <StatusBadge type="found" status="verified" /> */
export function StatusBadge({ type, status, className }) {
  const meta = STATUS_MAPS[type]?.[status] ?? { label: status, tone: 'slate' };
  return (
    <Badge tone={meta.tone} className={className}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
