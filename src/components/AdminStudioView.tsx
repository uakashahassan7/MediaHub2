import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, ExternalLink, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react';
import { api, uploadFileWithProgress } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  formatCompactCount,
  getLocalizedContent,
  parseTagsInput,
} from '../shared/contentLogic.ts';
import type { AdminStats, ContentItem, ContentStatus, ContentType } from '../shared/types.ts';

type StudioTab = 'content' | 'upload' | 'comments' | 'settings';

interface AdminCommentRow {
  id: string;
  contentId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  contentTitleEn: string;
  contentTitleUr: string;
  contentType: ContentType;
}

export function AdminStudioView() {
  const { lang, user, siteSettings, refreshSiteSettings, navigate, setAuthModalOpen } = useApp();
  const [tab, setTab] = useState<StudioTab>('content');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [comments, setComments] = useState<AdminCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Content Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<ContentType>('video');
  const [formStatus, setFormStatus] = useState<ContentStatus>('published');
  const [titleEn, setTitleEn] = useState('');
  const [titleUr, setTitleUr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionUr, setDescriptionUr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyUr, setBodyUr] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationSec, setDurationSec] = useState('0');
  const [tagsRaw, setTagsRaw] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [thumbProgress, setThumbProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  // Site Settings Form State
  const [siteNameEn, setSiteNameEn] = useState('');
  const [siteNameUr, setSiteNameUr] = useState('');
  const [logoText, setLogoText] = useState('');
  const [ownerNameEn, setOwnerNameEn] = useState('');
  const [ownerNameUr, setOwnerNameUr] = useState('');
  const [aboutEn, setAboutEn] = useState('');
  const [aboutUr, setAboutUr] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadStudioData = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    try {
      const [statsRes, contentRes, commentsRes] = await Promise.all([
        api.getAdminStats(),
        api.listContent({ includeDrafts: true }),
        api.getAdminComments(),
      ]);
      setStats(statsRes.stats);
      setItems(contentRes.items);
      setComments(commentsRes.comments);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  useEffect(() => {
    if (siteSettings) {
      setSiteNameEn(siteSettings.siteNameEn);
      setSiteNameUr(siteSettings.siteNameUr);
      setLogoText(siteSettings.logoText);
      setOwnerNameEn(siteSettings.ownerNameEn);
      setOwnerNameUr(siteSettings.ownerNameUr);
      setAboutEn(siteSettings.aboutEn);
      setAboutUr(siteSettings.aboutUr);
    }
  }, [siteSettings]);

  if (!user || user.role !== 'admin') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-4">
          <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {t(lang, 'studioTitle')}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {lang === 'ur'
              ? 'اس حصے تک رسائی صرف ایڈمن اکاؤنٹ کے لیے مختص ہے۔'
              : 'Admin privileges are required to access Creator Studio.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {!user && (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold"
              >
                {t(lang, 'signIn')}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              {t(lang, 'backToFeed')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const resetContentForm = () => {
    setEditingId(null);
    setFormType('video');
    setFormStatus('published');
    setTitleEn('');
    setTitleUr('');
    setDescriptionEn('');
    setDescriptionUr('');
    setBodyEn('');
    setBodyUr('');
    setMediaUrl('');
    setThumbnailUrl('');
    setDurationSec('0');
    setTagsRaw('');
    setUploadProgress(null);
    setThumbProgress(null);
    setFormError('');
    setFormSuccess('');
  };

  const startEdit = (item: ContentItem) => {
    setEditingId(item.id);
    setFormType(item.type);
    setFormStatus(item.status);
    setTitleEn(item.titleEn);
    setTitleUr(item.titleUr);
    setDescriptionEn(item.descriptionEn);
    setDescriptionUr(item.descriptionUr);
    setBodyEn(item.bodyEn);
    setBodyUr(item.bodyUr);
    setMediaUrl(item.mediaUrl);
    setThumbnailUrl(item.thumbnailUrl);
    setDurationSec(String(item.durationSec || 0));
    setTagsRaw(item.tags.join(', '));
    setFormError('');
    setFormSuccess('');
    setTab('upload');
  };

  const handlePrimaryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');
    const kind = formType === 'video' ? 'video' : 'image';
    const maxBytes = kind === 'video' ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;

    if (file.size > maxBytes) {
      setFormError(
        kind === 'video'
          ? 'Video file exceeds the 50 MB upload limit.'
          : 'Image file exceeds the 10 MB upload limit.',
      );
      return;
    }

    setUploadProgress(0);
    try {
      const result = await uploadFileWithProgress(file, kind, setUploadProgress);
      setMediaUrl(result.url);
      if (kind === 'image' && !thumbnailUrl) {
        setThumbnailUrl(result.url);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed.');
      setUploadProgress(null);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFormError('Thumbnail image exceeds the 10 MB upload limit.');
      return;
    }
    setThumbProgress(0);
    try {
      const result = await uploadFileWithProgress(file, 'image', setThumbProgress);
      setThumbnailUrl(result.url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Thumbnail upload failed.');
      setThumbProgress(null);
    }
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSavingContent(true);

    const payload = {
      type: formType,
      status: formStatus,
      titleEn,
      titleUr,
      descriptionEn,
      descriptionUr,
      bodyEn,
      bodyUr,
      mediaUrl,
      thumbnailUrl,
      durationSec: Number(durationSec) || 0,
      tags: parseTagsInput(tagsRaw),
    };

    try {
      if (editingId) {
        await api.updateContent(editingId, payload);
        setFormSuccess(lang === 'ur' ? 'مواد اپ ڈیٹ ہو گیا۔' : 'Content item updated.');
      } else {
        await api.createContent(payload);
        setFormSuccess(lang === 'ur' ? 'نیا مواد محفوظ ہو گیا۔' : 'Content item created.');
        resetContentForm();
      }
      await loadStudioData();
      setTab('content');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save content.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleToggleStatus = async (item: ContentItem) => {
    const nextStatus: ContentStatus = item.status === 'published' ? 'draft' : 'published';
    await api.updateContent(item.id, { status: nextStatus });
    await loadStudioData();
  };

  const handleDeleteContent = async (id: string) => {
    await api.deleteContent(id);
    setConfirmDeleteId(null);
    await loadStudioData();
  };

  const handleModerateDeleteComment = async (commentId: string) => {
    await api.deleteComment(commentId);
    await loadStudioData();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg('');
    setSettingsError('');
    setSavingSettings(true);
    try {
      await api.updateSettings({
        siteNameEn,
        siteNameUr,
        logoText,
        ownerNameEn,
        ownerNameUr,
        aboutEn,
        aboutUr,
      });
      await refreshSiteSettings();
      setSettingsMsg(t(lang, 'settingsSaved'));
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t(lang, 'studioTitle')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t(lang, 'studioSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetContentForm();
            setTab('upload');
          }}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{t(lang, 'tabUpload')}</span>
        </button>
      </div>

      {/* Overview Stats Row */}
      {stats && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: t(lang, 'statPublished'), value: stats.publishedItems },
            { label: t(lang, 'statDrafts'), value: stats.draftItems },
            { label: t(lang, 'statViews'), value: formatCompactCount(stats.totalViews) },
            { label: t(lang, 'statSubscribers'), value: formatCompactCount(stats.subscriberCount) },
            { label: t(lang, 'statComments'), value: stats.commentCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
            >
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {stat.label}
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {stat.value}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit"
      >
        {(
          [
            { id: 'content', label: t(lang, 'tabContent') },
            { id: 'upload', label: t(lang, 'tabUpload') },
            { id: 'comments', label: t(lang, 'tabComments') },
            { id: 'settings', label: t(lang, 'tabSettings') },
          ] as Array<{ id: StudioTab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Content Library */}
      {tab === 'content' && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-zinc-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <th className="py-3 px-4 text-start">{t(lang, 'colTitle')}</th>
                    <th className="py-3 px-4 text-start">{t(lang, 'colType')}</th>
                    <th className="py-3 px-4 text-start">{t(lang, 'colStatus')}</th>
                    <th className="py-3 px-4 text-start">{t(lang, 'colViews')}</th>
                    <th className="py-3 px-4 text-end">{t(lang, 'colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {items.map((item) => {
                    const loc = getLocalizedContent(item, lang);
                    const detailRoute =
                      item.type === 'video'
                        ? `/watch/${encodeURIComponent(item.id)}`
                        : item.type === 'image'
                          ? `/image/${encodeURIComponent(item.id)}`
                          : `/article/${encodeURIComponent(item.id)}`;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/40">
                        <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs truncate">
                          {loc.title}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                          {item.type === 'video'
                            ? t(lang, 'typeVideo')
                            : item.type === 'image'
                              ? t(lang, 'typeImage')
                              : t(lang, 'typeArticle')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              item.status === 'published'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {item.status === 'published'
                              ? t(lang, 'publishedBadge')
                              : t(lang, 'draftBadge')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 tabular-nums">
                          {formatCompactCount(item.viewCount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(detailRoute)}
                              aria-label={`Open ${loc.title}`}
                              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              aria-label={
                                item.status === 'published'
                                  ? `${t(lang, 'unpublishBtn')} ${loc.title}`
                                  : `${t(lang, 'publishBtn')} ${loc.title}`
                              }
                              title={
                                item.status === 'published'
                                  ? t(lang, 'unpublishBtn')
                                  : t(lang, 'publishBtn')
                              }
                              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              {item.status === 'published' ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              aria-label={`${t(lang, 'editBtn')} ${loc.title}`}
                              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {confirmDeleteId === item.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteContent(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
                              >
                                {t(lang, 'confirmDelete')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                aria-label={`${t(lang, 'deleteBtn')} ${loc.title}`}
                                className="p-2 rounded-lg text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Upload / Create / Edit Content */}
      {tab === 'upload' && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 max-w-4xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {editingId ? t(lang, 'uploadHeadingEdit') : t(lang, 'uploadHeadingNew')}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetContentForm}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400 underline underline-offset-4"
              >
                {t(lang, 'resetForm')}
              </button>
            )}
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="mb-5 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-800 dark:text-emerald-200">
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleSaveContent} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="content-type"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'contentTypeLabel')}
                </label>
                <select
                  id="content-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ContentType)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="video">{t(lang, 'typeVideo')}</option>
                  <option value="image">{t(lang, 'typeImage')}</option>
                  <option value="article">{t(lang, 'typeArticle')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="content-status"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'statusLabel')}
                </label>
                <select
                  id="content-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ContentStatus)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="published">{t(lang, 'publishedBadge')}</option>
                  <option value="draft">{t(lang, 'draftBadge')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="content-tags"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'tagsLabel')}
                </label>
                <input
                  id="content-tags"
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="lahore, documentary, architecture"
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* File Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              {formType !== 'article' && (
                <div className="space-y-2">
                  <label
                    htmlFor="primary-upload"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {formType === 'video' ? t(lang, 'videoFileLabel') : t(lang, 'imageFileLabel')}
                  </label>
                  <label
                    htmlFor="primary-upload"
                    className="flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:border-red-500"
                  >
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    <span>{formType === 'video' ? 'Choose video file' : 'Choose image file'}</span>
                    <input
                      id="primary-upload"
                      type="file"
                      accept={formType === 'video' ? 'video/*' : 'image/*'}
                      onChange={handlePrimaryFileUpload}
                      className="sr-only"
                    />
                  </label>
                  {uploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 tabular-nums">
                        {t(lang, 'uploadingProgress')}: {uploadProgress}%
                      </p>
                    </div>
                  )}
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={t(lang, 'mediaUrlOrUpload')}
                    aria-label={t(lang, 'mediaUrlOrUpload')}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="thumb-upload"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {t(lang, 'thumbnailFileLabel')}
                </label>
                <label
                  htmlFor="thumb-upload"
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:border-red-500"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Choose cover / thumbnail</span>
                  <input
                    id="thumb-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="sr-only"
                  />
                </label>
                {thumbProgress !== null && (
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-red-600 transition-all"
                        style={{ width: `${thumbProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {t(lang, 'uploadingProgress')}: {thumbProgress}%
                    </p>
                  </div>
                )}
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="/uploads/... or /src/assets/images/..."
                  aria-label="Thumbnail URL"
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {formType === 'video' && (
                <div>
                  <label
                    htmlFor="video-duration"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Duration (seconds)
                  </label>
                  <input
                    id="video-duration"
                    type="number"
                    min={0}
                    value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums"
                  />
                </div>
              )}
            </div>

            {/* Bilingual Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title-en"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'titleEnLabel')}
                  </label>
                  <input
                    id="title-en"
                    type="text"
                    dir="ltr"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="desc-en"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'descEnLabel')}
                  </label>
                  <textarea
                    id="desc-en"
                    dir="ltr"
                    rows={3}
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                {formType === 'article' && (
                  <div>
                    <label
                      htmlFor="body-en"
                      className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                    >
                      {t(lang, 'bodyEnLabel')}
                    </label>
                    <textarea
                      id="body-en"
                      dir="ltr"
                      rows={6}
                      value={bodyEn}
                      onChange={(e) => setBodyEn(e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title-ur"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'titleUrLabel')}
                  </label>
                  <input
                    id="title-ur"
                    type="text"
                    dir="rtl"
                    value={titleUr}
                    onChange={(e) => setTitleUr(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="desc-ur"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'descUrLabel')}
                  </label>
                  <textarea
                    id="desc-ur"
                    dir="rtl"
                    rows={3}
                    value={descriptionUr}
                    onChange={(e) => setDescriptionUr(e.target.value)}
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                {formType === 'article' && (
                  <div>
                    <label
                      htmlFor="body-ur"
                      className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                    >
                      {t(lang, 'bodyUrLabel')}
                    </label>
                    <textarea
                      id="body-ur"
                      dir="rtl"
                      rows={6}
                      value={bodyUr}
                      onChange={(e) => setBodyUr(e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  resetContentForm();
                  setTab('content');
                }}
                className="h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="submit"
                disabled={savingContent}
                className="h-10 px-5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {t(lang, 'saveContent')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Tab 3: Comment Moderation */}
      {tab === 'comments' && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
          {comments.length === 0 ? (
            <div className="p-8 text-sm text-zinc-500">{t(lang, 'noCommentsYet')}</div>
          ) : (
            comments.map((cmt) => {
              const title =
                lang === 'ur'
                  ? cmt.contentTitleUr || cmt.contentTitleEn
                  : cmt.contentTitleEn || cmt.contentTitleUr;
              return (
                <div key={cmt.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {cmt.authorName}
                      </span>
                      <span>({cmt.authorEmail})</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {title}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 break-words">
                      {cmt.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleModerateDeleteComment(cmt.id)}
                    aria-label={`${t(lang, 'deleteComment')} ${cmt.authorName}`}
                    className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                  >
                    {t(lang, 'deleteComment')}
                  </button>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Tab 4: Site Settings */}
      {tab === 'settings' && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 max-w-3xl">
          {settingsError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700"
            >
              {settingsError}
            </div>
          )}
          {settingsMsg && (
            <div className="mb-4 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-800 dark:text-emerald-200">
              {settingsMsg}
            </div>
          )}
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label
                htmlFor="set-logo"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'logoTextLabel')}
              </label>
              <input
                id="set-logo"
                type="text"
                required
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-name-en"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'siteNameEnLabel')}
                </label>
                <input
                  id="set-name-en"
                  type="text"
                  dir="ltr"
                  value={siteNameEn}
                  onChange={(e) => setSiteNameEn(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label
                  htmlFor="set-name-ur"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'siteNameUrLabel')}
                </label>
                <input
                  id="set-name-ur"
                  type="text"
                  dir="rtl"
                  value={siteNameUr}
                  onChange={(e) => setSiteNameUr(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label
                  htmlFor="set-owner-en"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'ownerNameEnLabel')}
                </label>
                <input
                  id="set-owner-en"
                  type="text"
                  dir="ltr"
                  value={ownerNameEn}
                  onChange={(e) => setOwnerNameEn(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label
                  htmlFor="set-owner-ur"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t(lang, 'ownerNameUrLabel')}
                </label>
                <input
                  id="set-owner-ur"
                  type="text"
                  dir="rtl"
                  value={ownerNameUr}
                  onChange={(e) => setOwnerNameUr(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="set-about-en"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'aboutEnLabel')}
              </label>
              <textarea
                id="set-about-en"
                dir="ltr"
                rows={3}
                value={aboutEn}
                onChange={(e) => setAboutEn(e.target.value)}
                className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label
                htmlFor="set-about-ur"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'aboutUrLabel')}
              </label>
              <textarea
                id="set-about-ur"
                dir="rtl"
                rows={3}
                value={aboutUr}
                onChange={(e) => setAboutUr(e.target.value)}
                className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="h-10 px-5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {t(lang, 'saveSettings')}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
