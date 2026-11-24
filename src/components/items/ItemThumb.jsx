import { ImageOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { itemImageUrl } from '@/utils/storage';

export function ItemThumb({ path, className }) {
  const url = itemImageUrl(path);
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400', className ?? 'size-14')}>
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff className="size-5" />}
    </span>
  );
}
