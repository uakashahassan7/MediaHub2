import type {
  AdminStats,
  ContentComment,
  ContentItem,
  ContentStatus,
  ContentType,
  Language,
  ReactionType,
  SiteSettings,
  UserProfile,
} from '../shared/types.ts';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getMe: () => requestJson<{ user: UserProfile | null }>('/api/auth/me'),

  login: (email: string, password: string) =>
    requestJson<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (email: string, password: string, displayName: string) =>
    requestJson<{ user: UserProfile }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  logout: () => requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (displayName: string, bio: string) =>
    requestJson<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName, bio }),
    }),

  requestPasswordReset: (email: string) =>
    requestJson<{ message: string; demoResetCode?: string }>('/api/auth/reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    requestJson<{ ok: boolean; message: string }>('/api/auth/reset-confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),

  getSettings: () => requestJson<{ settings: SiteSettings }>('/api/settings'),

  listContent: (params?: { type?: ContentType | 'all'; q?: string; includeDrafts?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.type && params.type !== 'all') search.set('type', params.type);
    if (params?.q) search.set('q', params.q);
    if (params?.includeDrafts) search.set('includeDrafts', '1');
    const qs = search.toString();
    return requestJson<{ items: ContentItem[] }>(`/api/content${qs ? `?${qs}` : ''}`);
  },

  getContentDetail: (id: string) =>
    requestJson<{ item: ContentItem; related: ContentItem[]; comments: ContentComment[] }>(
      `/api/content/${encodeURIComponent(id)}`,
    ),

  recordView: (id: string) =>
    requestJson<{ viewCount: number }>(`/api/content/${encodeURIComponent(id)}/view`, {
      method: 'POST',
    }),

  reactToContent: (id: string, type: ReactionType) =>
    requestJson<{
      likesCount: number;
      dislikesCount: number;
      userReaction: ReactionType | null;
    }>(`/api/content/${encodeURIComponent(id)}/react`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  addComment: (id: string, body: string) =>
    requestJson<{ comments: ContentComment[] }>(
      `/api/content/${encodeURIComponent(id)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    ),

  deleteComment: (commentId: string) =>
    requestJson<{ ok: boolean; comments: ContentComment[] }>(
      `/api/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    ),

  toggleSubscribe: () =>
    requestJson<{ subscribed: boolean; subscriberCount: number }>('/api/subscribe', {
      method: 'POST',
    }),

  // Admin
  getAdminStats: () => requestJson<{ stats: AdminStats }>('/api/admin/stats'),

  getAdminComments: () =>
    requestJson<{
      comments: Array<{
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
      }>;
    }>('/api/admin/comments'),

  createContent: (payload: {
    type: ContentType;
    status: ContentStatus;
    titleEn: string;
    titleUr: string;
    descriptionEn: string;
    descriptionUr: string;
    bodyEn: string;
    bodyUr: string;
    mediaUrl: string;
    thumbnailUrl: string;
    durationSec: number;
    tags: string[];
  }) =>
    requestJson<{ item: ContentItem }>('/api/admin/content', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateContent: (
    id: string,
    payload: Partial<{
      type: ContentType;
      status: ContentStatus;
      titleEn: string;
      titleUr: string;
      descriptionEn: string;
      descriptionUr: string;
      bodyEn: string;
      bodyUr: string;
      mediaUrl: string;
      thumbnailUrl: string;
      durationSec: number;
      tags: string[];
    }>,
  ) =>
    requestJson<{ item: ContentItem }>(`/api/admin/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteContent: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/admin/content/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  updateSettings: (payload: {
    siteNameEn: string;
    siteNameUr: string;
    logoText: string;
    ownerNameEn: string;
    ownerNameUr: string;
    aboutEn: string;
    aboutUr: string;
  }) =>
    requestJson<{ settings: SiteSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  analyzeContent: (contentId: string, question: string, lang: Language) =>
    requestJson<{ answer: string }>('/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ contentId, question, lang }),
    }),
};

export function uploadFileWithProgress(
  file: File,
  kind: 'video' | 'image',
  onProgress: (percent: number) => void,
): Promise<{ url: string; size: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload', true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(parsed);
        } else {
          reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error('Invalid upload response from server.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload.'));
    };

    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    xhr.send(formData);
  });
}
