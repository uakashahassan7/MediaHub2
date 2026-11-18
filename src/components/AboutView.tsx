import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';
import { formatCompactCount } from '../shared/contentLogic.ts';
import { MediaImage } from './MediaImage.tsx';

export function AboutView() {
  const { lang, user, siteSettings, refreshSiteSettings, setAuthModalOpen, navigate } = useApp();
  const [subPending, setSubPending] = useState(false);

  if (!siteSettings) return null;

  const siteName = lang === 'ur' ? siteSettings.siteNameUr : siteSettings.siteNameEn;
  const ownerName = lang === 'ur' ? siteSettings.ownerNameUr : siteSettings.ownerNameEn;
  const aboutText = lang === 'ur' ? siteSettings.aboutUr : siteSettings.aboutEn;
  const BackIcon = lang === 'ur' ? ArrowRight : ArrowLeft;

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

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
      >
        <BackIcon className="w-4 h-4" aria-hidden="true" />
        <span>{t(lang, 'backToFeed')}</span>
      </button>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
              <MediaImage src={siteSettings.ownerAvatar} alt={ownerName} loading="eager" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {siteName}
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
                {ownerName} · {formatCompactCount(siteSettings.subscriberCount)}{' '}
                {t(lang, 'subscribers')}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={subPending}
            onClick={handleSubscribe}
            className={`h-10 px-5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              siteSettings.isSubscribed
                ? 'border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {siteSettings.isSubscribed ? t(lang, 'subscribed') : t(lang, 'subscribe')}
          </button>
        </div>

        <div className="max-w-prose">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {t(lang, 'navAbout')}
          </h2>
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
            {aboutText}
          </p>
        </div>
      </section>
    </main>
  );
}
