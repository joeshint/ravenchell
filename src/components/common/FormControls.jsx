import { useId, useState, cloneElement, isValidElement } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

const controlBase =
  'block w-full rounded-lg border bg-white text-sm text-slate-900 shadow-card placeholder:text-slate-400 ' +
  'transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function controlClasses(invalid, className) {
  return cn(
    controlBase,
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-brand-600 focus:ring-brand-600/20',
    className,
  );
}

/**
 * Label + control + hint/error. The child control receives `id`,
 * `aria-invalid` and `aria-describedby` automatically.
 */
export function FormField({ label, error, hint, required, children, className, labelAction }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        invalid: Boolean(error),
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={children?.props?.id ?? id} className="block text-sm font-medium text-slate-700">
            {label}
            {required && (
              <span className="ml-0.5 text-red-600" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {labelAction}
        </div>
      )}
      {control}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs text-red-600" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Input({ invalid, className, ref, ...props }) {
  return <input ref={ref} className={controlClasses(invalid, cn('h-10 px-3', className))} {...props} />;
}

export function Textarea({ invalid, className, rows = 4, ref, ...props }) {
  return <textarea ref={ref} rows={rows} className={controlClasses(invalid, cn('px-3 py-2', className))} {...props} />;
}

export function Select({ invalid, className, children, placeholder, ref, ...props }) {
  return (
    <select ref={ref} className={controlClasses(invalid, cn('h-10 pr-8 pl-3', className))} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export function PasswordInput({ invalid, className, ref, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={controlClasses(invalid, cn('h-10 pr-10 pl-3', className))}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Checkbox({ label, className, ref, invalid: _invalid, ...props }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="size-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-600"
        {...props}
      />
      {label}
    </label>
  );
}
