import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Maximize2,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';
import {
  MAX_COMMENT_LENGTH,
  estimateReadingMinutes,
  formatCompactCount,
  getLocalizedContent,
} from '../shared/contentLogic.ts';
import type { ContentComment, ContentItem, ReactionType } from '../shared/types.ts';
import { MediaImage } from './MediaImage.tsx';

interface ContentDetailViewProps {
  id: string;
}

export function ContentDetailView({ id }: ContentDetailViewProps) {
  const { lang, user, siteSettings, refreshSiteSettings, navigate, setAuthModalOpen } = useApp();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [subPending, setSubPending] = useState(false);

  // Optional Deep Analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [analysisAnswer, setAnalysisAnswer] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setAnalysisOpen(false);
    setAnalysisAnswer('');
    setAnalysisError('');
    setQuestion('');

    api
      .getContentDetail(id)
      .then((res) => {
        if (!active) return;
        setItem(res.item);
        setRelated(res.related);
        setComments(res.comments);

        const localized = getLocalizedContent(res.item, lang);
        document.title = `${localized.title} — ${
          siteSettings ? (lang === 'ur' ? siteSettings.siteNameUr : siteSettings.siteNameEn) : 'MediaHub'
        }`;

        api
          .recordView(id)
          .then((v) => {
            if (active) {
              setItem((prev) => (prev ? { ...prev, viewCount: v.viewCount } : prev));
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load item.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  const handleReact = async (type: ReactionType) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!item) return;
    try {
      const res = await api.reactToContent(item.id, type);
      setItem((prev) =>
        prev
          ? {
              ...prev,
              likesCount: res.likesCount,
              dislikesCount: res.dislikesCount,
              userReaction: res.userReaction,
            }
          : prev,
      );
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Reaction failed.');
    }
  };

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

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard fallback ignored if blocked
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!item) return;
    setCommentError('');
    setCommentSubmitting(true);
    try {
      const res = await api.addComment(item.id, commentBody);
      setComments(res.comments);
      setCommentBody('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await api.deleteComment(commentId);
      setComments(res.comments);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to delete comment.');
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !question.trim()) return;
    setAnalysisError('');
    setAnalyzing(true);
    try {
      const res = await api.analyzeContent(item.id, question, lang);
      setAnalysisAnswer(res.answer);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis unavailable.');
    } finally {
      setAnalyzing(false);
    }
  };

  const BackIcon = lang === 'ur' ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          <div className="lg:col-span-8 space-y-4">
            <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-7 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-base text-zinc-700 dark:text-zinc-300">{error || 'Item not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold"
          >
            {t(lang, 'backToFeed')}
          </button>
        </div>
      </main>
    );
  }

  const localized = getLocalizedContent(item, lang);
  const typeLabel =
    item.type === 'video'
      ? t(lang, 'typeVideo')
      : item.type === 'image'
        ? t(lang, 'typeImage')
        : t(lang, 'typeArticle');
  const ownerName = siteSettings
    ? lang === 'ur'
      ? siteSettings.ownerNameUr
      : siteSettings.ownerNameEn
    : 'MediaHub';
  const dateText = new Intl.DateTimeFormat(lang === 'ur' ? 'ur-PK' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-5"
      >
        <BackIcon className="w-4 h-4" aria-hidden="true" />
        <span>{t(lang, 'backToFeed')}</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Media Presentation */}
          {item.type === 'video' && (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black aspect-video">
              <video
                key={item.id}
                src={item.mediaUrl}
                poster={item.thumbnailUrl || undefined}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {item.type === 'image' && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              <div className="max-h-[72vh] flex items-center justify-center">
                <MediaImage
                  src={item.mediaUrl || item.thumbnailUrl}
                  alt={localized.title}
                  type="image"
                  loading="eager"
                  className="w-full max-h-[72vh] object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={t(lang, 'openLightbox')}
                className="absolute top-3 end-3 h-9 px-3 flex items-center gap-1.5 rounded-lg bg-zinc-950/80 text-white text-xs font-medium hover:bg-zinc-950 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t(lang, 'openLightbox')}</span>
              </button>
            </div>
          )}

          {item.type === 'article' && item.thumbnailUrl && (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/9]">
              <MediaImage
                src={item.thumbnailUrl}
                alt={localized.title}
                type="article"
                loading="eager"
              />
            </div>
          )}

          {/* Title & Meta */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span className="font-semibold text-red-700 dark:text-red-400">{typeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {formatCompactCount(item.viewCount)} {t(lang, 'views')}
              </span>
              <span aria-hidden="true">·</span>
              <span>{dateText}</span>
              {item.type === 'article' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {estimateReadingMinutes(localized.body || localized.description)} {t(lang, 'minRead')}
                  </span>
                </>
              )}
              {item.status === 'draft' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {t(lang, 'draftBadge')}
                  </span>
                </>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance leading-tight">
              {localized.title}
            </h1>
          </div>

          {/* Creator & Engagement Bar */}
          <div className="py-4 border-y border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
            {siteSettings && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
                  <MediaImage src={siteSettings.ownerAvatar} alt={ownerName} loading="eager" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {ownerName}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {formatCompactCount(siteSettings.subscriberCount)} {t(lang, 'subscribers')}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={subPending}
                  onClick={handleSubscribe}
                  className={`ms-2 h-9 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    siteSettings.isSubscribed
                      ? 'border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                      : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                  }`}
                >
                  {siteSettings.isSubscribed ? t(lang, 'subscribed') : t(lang, 'subscribe')}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleReact('like')}
                  aria-pressed={item.userReaction === 'like'}
                  aria-label={t(lang, 'like')}
                  className={`h-9 px-3.5 flex items-center gap-1.5 text-xs sm:text-sm font-medium border-e border-zinc-200 dark:border-zinc-800 transition-colors tabular-nums ${
                    item.userReaction === 'like'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                  <span>{formatCompactCount(item.likesCount)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReact('dislike')}
                  aria-pressed={item.userReaction === 'dislike'}
                  aria-label={t(lang, 'dislike')}
                  className={`h-9 px-3.5 flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors tabular-nums ${
                    item.userReaction === 'dislike'
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" aria-hidden="true" />
                  <span>{formatCompactCount(item.dislikesCount)}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="h-9 px-3.5 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{copied ? t(lang, 'linkCopied') : t(lang, 'share')}</span>
              </button>
            </div>
          </div>

          {/* Description / Article Body */}
          <div className="space-y-5">
            {localized.description && (
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {localized.description}
              </p>
            )}

            {item.type === 'article' && localized.body && (
              <div
                className={`max-w-prose space-y-5 text-zinc-800 dark:text-zinc-200 ${
                  lang === 'ur' ? 'text-lg leading-loose' : 'text-base leading-relaxed'
                }`}
              >
                {localized.body.split(/\n\n+/).map((para, idx) => (
                  <p key={idx} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {item.tags.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {item.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Collapsible Deep Analysis Panel */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setAnalysisOpen((v) => !v)}
              aria-expanded={analysisOpen}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-4"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t(lang, 'deepAnalysisToggle')}</span>
            </button>

            {analysisOpen && (
              <div className="mt-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                <form onSubmit={handleAnalyze} className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t(lang, 'deepAnalysisPlaceholder')}
                    aria-label={t(lang, 'deepAnalysisPlaceholder')}
                    className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <button
                    type="submit"
                    disabled={analyzing || !question.trim()}
                    className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    {analyzing ? t(lang, 'deepAnalysisThinking') : t(lang, 'deepAnalysisSubmit')}
                  </button>
                </form>

                {analysisError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{analysisError}</p>
                )}
                {analysisAnswer && (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {analysisAnswer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <section className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-5">
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {t(lang, 'comments')} ({comments.length})
            </h2>

            {user ? (
              <form onSubmit={handleCommentSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  maxLength={MAX_COMMENT_LENGTH}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={t(lang, 'commentPlaceholder')}
                  aria-label={t(lang, 'commentPlaceholder')}
                  className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                {commentError && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                    {commentError}
                  </p>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {commentBody.length} / {MAX_COMMENT_LENGTH}
                  </span>
                  <button
                    type="submit"
                    disabled={commentSubmitting || !commentBody.trim()}
                    className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {t(lang, 'postComment')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t(lang, 'signInToEngage')}
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  {t(lang, 'signIn')}
                </button>
              </div>
            )}

            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
                {t(lang, 'noCommentsYet')}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {comments.map((cmt) => {
                  const canDelete = user && (user.id === cmt.userId || user.role === 'admin');
                  return (
                    <li key={cmt.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {cmt.authorName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {new Intl.DateTimeFormat(lang === 'ur' ? 'ur-PK' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(cmt.createdAt))}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line break-words">
                          {cmt.body}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(cmt.id)}
                          aria-label={`${t(lang, 'deleteComment')} ${cmt.authorName}`}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Related Rail */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Reserved Phase 2 Ad Slot Placeholder (hidden by default) */}
          <div data-ad-slot="detail-sidebar" className="hidden" aria-hidden="true" />

          <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t(lang, 'relatedItems')}
          </h2>

          <div className="space-y-4">
            {related.map((rel) => {
              const relLoc = getLocalizedContent(rel, lang);
              const relRoute =
                rel.type === 'video'
                  ? `/watch/${encodeURIComponent(rel.id)}`
                  : rel.type === 'image'
                    ? `/image/${encodeURIComponent(rel.id)}`
                    : `/article/${encodeURIComponent(rel.id)}`;
              const relTypeLabel =
                rel.type === 'video'
                  ? t(lang, 'typeVideo')
                  : rel.type === 'image'
                    ? t(lang, 'typeImage')
                    : t(lang, 'typeArticle');

              return (
                <a
                  key={rel.id}
                  href={relRoute}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(relRoute);
                  }}
                  className="group flex gap-3 items-start rounded-lg p-1.5 -mx-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="w-36 aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shrink-0">
                    <MediaImage
                      src={rel.thumbnailUrl || (rel.type === 'image' ? rel.mediaUrl : '')}
                      alt={relLoc.title}
                      type={rel.type}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 line-clamp-2 leading-snug">
                      {relLoc.title}
                    </h3>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {relTypeLabel} · {formatCompactCount(rel.viewCount)} {t(lang, 'views')}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxOpen && item.type === 'image' && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={localized.title}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={t(lang, 'closeLightbox')}
            className="absolute top-4 end-4 h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900/90 text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={item.mediaUrl || item.thumbnailUrl}
            alt={localized.title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </main>
  );
}
