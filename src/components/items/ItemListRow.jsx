import { Link } from 'react-router';
import { CalendarDays, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/common/Badge';
import { formatDate } from '@/utils/format';
import { ItemThumb } from './ItemThumb';

/** Compact list-view row for public listings. */
export function ItemListRow({ item, type }) {
  const href = `/${type}/${item.id}`;
  const date = type === 'lost' ? item.date_lost : item.date_found;
  const place = [item.location?.name, item.campus?.code ?? item.campus?.name].filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        to={href}
        className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-card transition-shadow hover:shadow-pop sm:p-4"
      >
        <ItemThumb path={item.image_path} className="size-16 sm:size-20" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{item.item_name}</h3>
            <StatusBadge type={type} status={item.status} />
          </div>
          <p className="mt-0.5 text-xs font-medium text-brand-700">{item.category?.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {place || 'Location not specified'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatDate(date)}
            </span>
          </div>
        </div>
        <span className="hidden font-mono text-xs text-slate-400 md:block">{item.reference_no}</span>
      </Link>
    </li>
  );
}
