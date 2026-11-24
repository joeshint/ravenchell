import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value);
  return isValid(d) ? d : null;
}

/** "Nov 18, 2026" */
export function formatDate(value) {
  const d = toDate(value);
  return d ? format(d, 'MMM d, yyyy') : '—';
}

/** "Nov 18, 2026, 3:05 PM" */
export function formatDateTime(value) {
  const d = toDate(value);
  return d ? format(d, 'MMM d, yyyy, h:mm a') : '—';
}

/** "3 hours ago" */
export function formatRelative(value) {
  const d = toDate(value);
  return d ? `${formatDistanceToNowStrict(d)} ago` : '—';
}

/** "15:30:00" → "3:30 PM" */
export function formatTime(value) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const date = new Date(2000, 0, 1, h, m || 0);
  return format(date, 'h:mm a');
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-PH').format(Number(value ?? 0));
}

/** Today's date in the Philippines as yyyy-MM-dd (matches public.manila_today()). */
export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
