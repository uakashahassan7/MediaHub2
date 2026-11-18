import { BookOpen, Image as ImageIcon, Play } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';
import {
  estimateReadingMinutes,
  formatCompactCount,
  formatDuration,
  getLocalizedContent,
} from '../shared/contentLogic.ts';
import type { ContentItem } from '../shared/types.ts';
import { MediaImage } from './MediaImage.tsx';

interface MediaCardProps {
  item: ContentItem;
}

export function MediaCard({ item }: MediaCardProps) {
  const { lang, navigate } = useApp();
  const localized = getLocalizedContent(item, lang);

  const targetRoute =
    item.type === 'video'
      ? `/watch/${encodeURIComponent(item.id)}`
      : item.type === 'image'
        ? `/image/${encodeURIComponent(item.id)}`
        : `/article/${encodeURIComponent(item.id)}`;

  const typeLabel =
    item.type === 'video'
      ? t(lang, 'typeVideo')
      : item.type === 'image'
        ? t(lang, 'typeImage')
        : t(lang, 'typeArticle');

  const dateText = new Intl.DateTimeFormat(lang === 'ur' ? 'ur-PK' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(item.createdAt));

  const cornerMeta =
    item.type === 'video'
      ? formatDuration(item.durationSec)
      : item.type === 'article'
        ? `${estimateReadingMinutes(localized.body || localized.description)} ${t(lang, 'minRead')}`
        : typeLabel;

  const thumbnailSrc = item.thumbnailUrl || (item.type === 'image' ? item.mediaUrl : '');

  return (
    <article className="group flex flex-col">
      <a
        href={targetRoute}
        onClick={(e) => {
          e.preventDefault();
          navigate(targetRoute);
        }}
        className="block rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 aspect-video relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
      >
        <MediaImage
          src={thumbnailSrc}
          alt={localized.title}
          type={item.type}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-70" />

        <div className="pointer-events-none absolute bottom-2.5 end-2.5 flex items-center gap-1.5 bg-zinc-950/85 text-zinc-100 text-xs font-medium px-2 py-0.5 rounded tabular-nums">
          {item.type === 'video' && <Play className="w-3 h-3 fill-current" aria-hidden="true" />}
          {item.type === 'image' && <ImageIcon className="w-3 h-3" aria-hidden="true" />}
          {item.type === 'article' && <BookOpen className="w-3 h-3" aria-hidden="true" />}
          <span>{cornerMeta}</span>
        </div>
      </a>

      <div className="pt-3 flex flex-col gap-1">
        <a
          href={targetRoute}
          onClick={(e) => {
            e.preventDefault();
            navigate(targetRoute);
          }}
          className="font-display text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2"
        >
          {localized.title}
        </a>

        {localized.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {localized.description}
          </p>
        )}

        {/* Zero-pill unboxed metadata with typographic separators */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{typeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>
            {formatCompactCount(item.viewCount)} {t(lang, 'views')}
          </span>
          <span aria-hidden="true">·</span>
          <span>{dateText}</span>
          {item.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span dir="ltr" className="truncate max-w-[16ch]">
                #{item.tags[0]}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
