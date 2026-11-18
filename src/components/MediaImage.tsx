import { useState } from 'react';
import { BookOpen, Film, Image as ImageIcon } from 'lucide-react';
import type { ContentType } from '../shared/types.ts';

interface MediaImageProps {
  src?: string;
  alt: string;
  type?: ContentType;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function MediaImage({
  src,
  alt,
  type = 'image',
  className = 'w-full h-full object-cover',
  loading = 'lazy',
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const FallbackIcon = type === 'video' ? Film : type === 'article' ? BookOpen : ImageIcon;
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 text-zinc-500 dark:text-zinc-400 p-2.5 text-center overflow-hidden"
        aria-label={alt}
      >
        <FallbackIcon className="w-5 h-5 opacity-70 shrink-0" />
        <span className="text-[11px] font-medium leading-tight line-clamp-2 max-w-[20ch]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
