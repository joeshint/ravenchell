import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { getPublicUrl } from '@/utils/storage';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-lg', xl: 'size-24 text-2xl' };

/** Shows the profile photo (avatars bucket path or full URL) or initials. */
export function Avatar({ name, src, size = 'md', className }) {
  const url = src ? (src.startsWith('http') ? src : getPublicUrl('avatars', src)) : null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-800',
        SIZES[size],
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initials(name) || '?'}
    </span>
  );
}
