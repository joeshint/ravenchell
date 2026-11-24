import { cn } from '@/utils/cn';

/** Segmented tabs. options: [{ value, label, count? }] */
export function Tabs({ value, onChange, options, className, label = 'Tabs' }) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex rounded-lg bg-slate-100 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-slate-900 shadow-card' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  active ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-600',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
