import { Link } from 'react-router';
import { CalendarDays, ImageOff, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Feedback';
import { formatDate } from '@/utils/format';
import { itemImageUrl } from '@/utils/storage';

/**
 * Public item card. `type` is 'lost' or 'found'; `item` uses the columns from
 * LOST_LIST_COLUMNS / FOUND_LIST_COLUMNS in services/items.service.js.
 */
export function ItemCard({ item, type }) {
  const href = `/${type}/${item.id}`;
  const image = itemImageUrl(item.image_path);
  const date = type === 'lost' ? item.date_lost : item.date_found;
  const place = [item.location?.name, item.campus?.code ?? item.campus?.name].filter(Boolean).join(' · ');

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-pop">
      <Link to={href} className="relative block aspect-[4/3] bg-slate-100" tabIndex={-1} aria-hidden="true">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-slate-400">
            <ImageOff className="size-7" />
            <span className="text-xs">No photo</span>
          </div>
        )}
        <span className="absolute top-3 left-3">
          <StatusBadge type={type} status={item.status} className="bg-white/95 shadow-card" />
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-brand-700">{item.category?.name ?? 'Uncategorized'}</p>
        <h3 className="mt-1 line-clamp-1 text-base font-semibold text-slate-900">
          <Link to={href} className="hover:text-brand-700 focus:outline-none">
            {item.item_name}
          </Link>
        </h3>
        <dl className="mt-3 space-y-1.5 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <dd className="line-clamp-1">{place || 'Location not specified'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">{type === 'lost' ? 'Date lost' : 'Date found'}</dt>
            <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <dd>
              {type === 'lost' ? 'Lost' : 'Found'} {formatDate(date)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="font-mono text-[11px] text-slate-400">{item.reference_no}</span>
          <Link to={href} className="text-sm font-medium text-brand-700 hover:text-brand-800">
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
