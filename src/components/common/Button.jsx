import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-card disabled:bg-brand-600/60',
  dark: 'bg-brand-800 text-white hover:bg-brand-900 shadow-card disabled:bg-brand-800/60',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:opacity-60',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-card disabled:opacity-60',
  'outline-light': 'border border-white/40 bg-transparent text-white hover:bg-white/10 disabled:opacity-60',
  ghost:'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-card disabled:bg-red-600/60',
  'danger-outline': 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
};

/**
 * Button that can also render as a router <Link> (pass `to`) or a plain
 * anchor (pass `href`). `loading` disables it and shows a spinner.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  to,
  href,
  className,
  children,
  icon: Icon,
  type = 'button',
  ...props
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="size-4" aria-hidden="true" />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
