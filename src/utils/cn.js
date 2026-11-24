import { clsx } from 'clsx';

/** Join conditional class names: cn('a', cond && 'b', { c: flag }). */
export function cn(...inputs) {
  return clsx(inputs);
}
