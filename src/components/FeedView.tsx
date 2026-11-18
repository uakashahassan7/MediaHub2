import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';
import { formatCompactCount } from '../shared/contentLogic.ts';
import type { ContentItem, ContentType } from '../shared/types.ts';
import { MediaCard } from './MediaCard.tsx';
import { MediaImage } from './MediaImage.tsx';

interface FeedViewProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function FeedView({ searchQuery, onSearchChange }: FeedViewProps) {
  const { lang, user, siteSettings, refreshSiteSettings, setAuthModalOpen } = useApp();
  const [activeType, setActiveType] = useState<ContentType | 'all'>('all');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subPending, setSubPending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .listContent({ type: activeType, q: searchQuery })
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load feed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeType, searchQuery, user?.id]);

  const handleSubscribe = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSubPending(true);
    try {
      await api.toggleSubscribe();
      await refreshSiteSettings();
    } finally {
      setSubPending(false);
    }
  };

  const siteName = siteSettings
    ? lang === 'ur'
      ? siteSettings.siteNameUr
      : siteSettings.siteNameEn
    : 'MediaHub';
  const ownerName = siteSettings
    ? lang === 'ur'
      ? siteSettings.ownerNameUr
      : siteSettings.ownerNameEn
    : '';
  const aboutSummary = siteSettings
    ? lang === 'ur'
      ? siteSettings.aboutUr
      : siteSettings.aboutEn
    : '';

  const filters: Array<{ key: ContentType | 'all'; label: string }> = [
    { key: 'all', label: t(lang, 'filterAll') },
    { key: 'video', label: t(lang, 'filterVideo') },
    { key: 'image', label: t(lang, 'filterImage') },
    { key: 'article', label: t(lang, 'filterArticle') },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Mobile Search Bar */}
      <div className="md:hidden relative flex items-center">
        <Search
          className="w-4 h-4 text-zinc-400 pointer-events-none absolute start-3"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(lang, 'searchPlaceholder')}
          aria-label={t(lang, 'searchPlaceholder')}
          className="w-full h-10 ps-9 pe-8 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t(lang, 'clearSearch')}
            className="absolute end-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Channel Header Strip */}
      {siteSettings && (
        <section className="pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
              <MediaImage
                src={siteSettings.ownerAvatar}
                alt={ownerName}
                type="image"
                loading="eager"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
                {siteName}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{ownerName}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatCompactCount(siteSettings.subscriberCount)} {t(lang, 'subscribers')}
                </span>
              </div>
              {aboutSummary && (
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1 max-w-2xl">
                  {aboutSummary}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled={subPending}
              onClick={handleSubscribe}
              className={`h-10 px-5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                siteSettings.isSubscribed
                  ? 'border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
              }`}
            >
              {siteSettings.isSubscribed ? t(lang, 'subscribed') : t(lang, 'subscribe')}
            </button>
          </div>
        </section>
      )}

      {/* Type Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
          role="tablist"
          aria-label="Content type filter"
        >
          {filters.map((f) => {
            const active = activeType === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveType(f.key)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {!loading && `${items.length} ${lang === 'ur' ? 'مواد' : items.length === 1 ? 'item' : 'items'}`}
        </div>
      </div>

      {/* Reserved Phase 2 Ad Slot Placeholder (hidden by default per PRD) */}
      <div
        data-ad-slot="feed-banner"
        className="hidden rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center text-xs text-zinc-400"
        aria-hidden="true"
      />

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="space-y-3 animate-pulse">
              <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t(lang, 'noResultsTitle')}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            {t(lang, 'noResultsBody')}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveType('all');
              onSearchChange('');
            }}
            className="mt-4 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
          >
            {t(lang, 'resetFilters')}
          </button>
        </div>
      ) : (
        <div
          data-testid="feed-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8"
        >
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
