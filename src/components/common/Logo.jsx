import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Logo({ to = '/', className, light = false, compact = false }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="CvSU Lost and Found home">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
        <Search className="size-5" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block text-sm font-bold tracking-tight', light ? 'text-white' : 'text-brand-800')}>
            CvSU
          </span>
          <span className={cn('block text-xs font-medium', light ? 'text-brand-100' : 'text-slate-500')}>
            Lost and Found
          </span>
        </span>
      )}
    </Link>
  );
}
