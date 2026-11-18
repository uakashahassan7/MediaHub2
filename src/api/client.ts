import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../lib/supabaseClient.ts';
import type {
  AdminStats, ContentComment, ContentItem, ContentStatus, ContentType,
  Language, ReactionType, SiteSettings, UserProfile,
} from '../shared/types.ts';

type DbRow = Record<string, any>;

function fail(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || 'Supabase request failed.');
}

function mapProfile(row: DbRow, email = ''): UserProfile {
  return {
    id: row.id, email, displayName: row.display_name || email.split('@')[0] || 'Member',
    role: row.role === 'admin' ? 'admin' : 'viewer', bio: row.bio || '',
    avatarUrl: row.avatar_url || '', createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapContent(row: DbRow, reaction: ReactionType | null = null): ContentItem {
  return {
    id: row.id, authorId: row.author_id, type: row.type, status: row.status,
    titleEn: row.title_en || '', titleUr: row.title_ur || '',
    descriptionEn: row.description_en || '', descriptionUr: row.description_ur || '',
    bodyEn: row.body_en || '', bodyUr: row.body_ur || '',
    mediaUrl: row.media_url || '', thumbnailUrl: row.thumbnail_url || '',
    durationSec: Number(row.duration_seconds || 0), tags: row.tags || [],
    viewCount: Number(row.view_count || 0), likesCount: Number(row.likes_count || 0),
    dislikesCount: Number(row.dislikes_count || 0), commentCount: Number(row.comment_count || 0),
    createdAt: row.created_at, updatedAt: row.updated_at, userReaction: reaction,
  };
}

function mapComment(row: DbRow): ContentComment {
  const profile = row.author || row.profiles || {};
  return {
    id: row.id, contentId: row.content_id, userId: row.user_id,
    authorName: profile.display_name || 'Member', authorAvatar: profile.avatar_url || '',
    authorRole: profile.role === 'admin' ? 'admin' : 'viewer',
    body: row.body, createdAt: row.created_at,
  };
}

async function currentProfile(): Promise<UserProfile | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  fail(authError);
  const user = auth.user;
  if (!user) return null;
  let { data: row, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  fail(error);
  if (!row) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id, display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Member',
    });
    fail(insertError);
    const result = await supabase.from('profiles').select('*').eq('id', user.id).single();
    fail(result.error);
    row = result.data;
  }
  // One-time safe bootstrap: the first authenticated account can claim the empty admin seat.
  await supabase.rpc('claim_first_admin');
  const refreshed = await supabase.from('profiles').select('*').eq('id', user.id).single();
  fail(refreshed.error);
  return mapProfile(refreshed.data, user.email || '');
}

async function getSettingsData(): Promise<{ row: DbRow | null; settings: SiteSettings }> {
  const { data, error } = await supabase.from('site_settings').select('*').order('id').limit(1).maybeSingle();
  fail(error);
  const row = data as DbRow | null;
  const ownerId = row?.owner_id || '';
  let owner: DbRow | null = null;
  if (ownerId) {
    const result = await supabase.from('profiles').select('*').eq('id', ownerId).maybeSingle();
    fail(result.error);
    owner = result.data as DbRow | null;
  }
  let subscriberCount = 0;
  if (ownerId) {
    const countResult = await supabase.rpc('subscriber_count', { channel: ownerId });
    if (!countResult.error) subscriberCount = Number(countResult.data || 0);
  }
  return {
    row,
    settings: {
      siteNameEn: row?.site_name || 'MediaHub',
      siteNameUr: row?.site_name_ur || 'میڈیا ہب',
      logoText: row?.logo_text || 'MediaHub', ownerId,
      ownerNameEn: owner?.display_name || 'MediaHub Creator',
      ownerNameUr: owner?.display_name || 'میڈیا ہب',
      ownerAvatar: owner?.avatar_url || '', aboutEn: row?.about_text || '',
      aboutUr: row?.about_text_ur || '', subscriberCount, isSubscribed: false,
    },
  };
}

async function commentsFor(contentId: string): Promise<ContentComment[]> {
  const { data, error } = await supabase.from('comments')
    .select('*, author:profiles!comments_user_id_fkey(display_name,avatar_url,role)')
    .eq('content_id', contentId).order('created_at', { ascending: false });
  fail(error);
  return (data || []).map(mapComment);
}

const contentFields = (payload: Partial<ContentItem> & DbRow) => ({
  ...(payload.type !== undefined ? { type: payload.type } : {}),
  ...(payload.status !== undefined ? { status: payload.status } : {}),
  ...(payload.titleEn !== undefined ? { title_en: payload.titleEn } : {}),
  ...(payload.titleUr !== undefined ? { title_ur: payload.titleUr } : {}),
  ...(payload.descriptionEn !== undefined ? { description_en: payload.descriptionEn } : {}),
  ...(payload.descriptionUr !== undefined ? { description_ur: payload.descriptionUr } : {}),
  ...(payload.bodyEn !== undefined ? { body_en: payload.bodyEn } : {}),
  ...(payload.bodyUr !== undefined ? { body_ur: payload.bodyUr } : {}),
  ...(payload.mediaUrl !== undefined ? { media_url: payload.mediaUrl } : {}),
  ...(payload.thumbnailUrl !== undefined ? { thumbnail_url: payload.thumbnailUrl } : {}),
  ...(payload.durationSec !== undefined ? { duration_seconds: payload.durationSec } : {}),
  ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
});

export const api = {
  getMe: async () => ({ user: await currentProfile() }),
  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    fail(error);
    const user = await currentProfile();
    if (!user) throw new Error('Could not load your account profile.');
    return { user };
  },
  signup: async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: displayName } },
    });
    fail(error);
    if (!data.session) throw new Error('Please check your email and confirm your account, then sign in.');
    const user = await currentProfile();
    if (!user) throw new Error('Account created. Please sign in to continue.');
    return { user };
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    fail(error);
    return { ok: true };
  },
  updateProfile: async (displayName: string, bio: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in first.');
    const { error } = await supabase.from('profiles').update({ display_name: displayName, bio }).eq('id', auth.user.id);
    fail(error);
    const user = await currentProfile();
    if (!user) throw new Error('Profile update failed.');
    return { user };
  },
  requestPasswordReset: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    fail(error);
    return { message: 'Password reset email sent. Open the email link, then enter the recovery code from the email here.' };
  },
  confirmPasswordReset: async (email: string, code: string, newPassword: string) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    fail(verifyError);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    fail(error);
    return { ok: true, message: 'Password updated. You may now sign in.' };
  },
  getSettings: async () => {
    const { settings } = await getSettingsData();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user && settings.ownerId) {
      const { data, error } = await supabase.from('subscriptions').select('id')
        .eq('subscriber_id', auth.user.id).eq('creator_id', settings.ownerId).maybeSingle();
      fail(error);
      settings.isSubscribed = Boolean(data);
    }
    return { settings };
  },
  listContent: async (params?: { type?: ContentType | 'all'; q?: string; includeDrafts?: boolean }) => {
    let query = supabase.from('content_items').select('*').order('created_at', { ascending: false });
    if (params?.type && params.type !== 'all') query = query.eq('type', params.type);
    if (!params?.includeDrafts) query = query.eq('status', 'published');
    if (params?.q) query = query.or(`title_en.ilike.%${params.q}%,title_ur.ilike.%${params.q}%,description_en.ilike.%${params.q}%,description_ur.ilike.%${params.q}%`);
    const { data, error } = await query;
    fail(error);
    const { data: auth } = await supabase.auth.getUser();
    let reactions: DbRow[] = [];
    if (auth.user && data?.length) {
      const result = await supabase.from('reactions').select('content_id,type').eq('user_id', auth.user.id);
      if (!result.error) reactions = result.data || [];
    }
    const byId = new Map(reactions.map((r) => [r.content_id, r.type as ReactionType]));
    return { items: (data || []).map((row) => mapContent(row, byId.get(row.id) || null)) };
  },
  getContentDetail: async (id: string) => {
    const { data, error } = await supabase.from('content_items').select('*').eq('id', id).maybeSingle();
    fail(error);
    if (!data) throw new Error('Content item not found.');
    const { data: auth } = await supabase.auth.getUser();
    let reaction: ReactionType | null = null;
    if (auth.user) {
      const r = await supabase.from('reactions').select('type').eq('user_id', auth.user.id).eq('content_id', id).maybeSingle();
      if (!r.error) reaction = r.data?.type || null;
    }
    const related = await supabase.from('content_items').select('*').eq('status', 'published')
      .neq('id', id).order('created_at', { ascending: false }).limit(6);
    fail(related.error);
    return { item: mapContent(data, reaction), related: (related.data || []).map((x) => mapContent(x)), comments: await commentsFor(id) };
  },
  recordView: async (id: string) => {
    const { error } = await supabase.rpc('increment_view', { p_content_id: id });
    fail(error);
    const { data, error: readError } = await supabase.from('content_items').select('view_count').eq('id', id).single();
    fail(readError);
    if (!data) throw new Error('Content item not found.');
    return { viewCount: Number(data.view_count || 0) };
  },
  reactToContent: async (id: string, type: ReactionType) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in to react.');
    const found = await supabase.from('reactions').select('id,type').eq('user_id', auth.user.id).eq('content_id', id).maybeSingle();
    fail(found.error);
    if (found.data?.type === type) {
      const { error } = await supabase.from('reactions').delete().eq('id', found.data.id);
      fail(error);
    } else if (found.data) {
      const { error } = await supabase.from('reactions').update({ type }).eq('id', found.data.id);
      fail(error);
    } else {
      const { error } = await supabase.from('reactions').insert({ user_id: auth.user.id, content_id: id, type });
      fail(error);
    }
    const { data, error } = await supabase.from('content_items').select('likes_count,dislikes_count').eq('id', id).single();
    fail(error);
    if (!data) throw new Error('Content item not found.');
    const latest = await supabase.from('reactions').select('type').eq('user_id', auth.user.id).eq('content_id', id).maybeSingle();
    return { likesCount: data.likes_count, dislikesCount: data.dislikes_count, userReaction: latest.data?.type || null };
  },
  addComment: async (id: string, body: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in to comment.');
    const { error } = await supabase.from('comments').insert({ content_id: id, user_id: auth.user.id, body: body.trim() });
    fail(error);
    return { comments: await commentsFor(id) };
  },
  deleteComment: async (commentId: string) => {
    const found = await supabase.from('comments').select('content_id').eq('id', commentId).single();
    fail(found.error);
    if (!found.data) throw new Error('Comment not found.');
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    fail(error);
    return { ok: true, comments: await commentsFor(found.data.content_id) };
  },
  toggleSubscribe: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in to subscribe.');
    const { settings } = await getSettingsData();
    if (!settings.ownerId) throw new Error('The channel owner has not been configured yet.');
    const found = await supabase.from('subscriptions').select('id').eq('subscriber_id', auth.user.id).eq('creator_id', settings.ownerId).maybeSingle();
    fail(found.error);
    if (found.data) {
      const { error } = await supabase.from('subscriptions').delete().eq('id', found.data.id);
      fail(error);
    } else {
      const { error } = await supabase.from('subscriptions').insert({ subscriber_id: auth.user.id, creator_id: settings.ownerId });
      fail(error);
    }
    const count = await supabase.rpc('subscriber_count', { channel: settings.ownerId });
    fail(count.error);
    return { subscribed: !found.data, subscriberCount: Number(count.data || 0) };
  },
  getAdminStats: async () => {
    const count = async (table: string, filters?: (q: any) => any) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (filters) q = filters(q);
      const { count: n, error } = await q;
      fail(error);
      return n || 0;
    };
    const [totalItems, publishedItems, draftItems, videoCount, imageCount, articleCount, totalViews, commentCount] = await Promise.all([
      count('content_items'), count('content_items', q => q.eq('status','published')),
      count('content_items', q => q.eq('status','draft')), count('content_items', q => q.eq('type','video')),
      count('content_items', q => q.eq('type','image')), count('content_items', q => q.eq('type','article')),
      (async () => { const { data, error } = await supabase.from('content_items').select('view_count'); fail(error); return (data || []).reduce((n, x) => n + Number(x.view_count || 0), 0); })(),
      count('comments'),
    ]);
    const { settings } = await getSettingsData();
    return { stats: { totalItems, publishedItems, draftItems, videoCount, imageCount, articleCount, totalViews, subscriberCount: settings.subscriberCount, commentCount } as AdminStats };
  },
  getAdminComments: async () => {
    const { data, error } = await supabase.from('comments')
      .select('id,content_id,user_id,body,created_at,author:profiles!comments_user_id_fkey(display_name),content:content_items!comments_content_id_fkey(title_en,title_ur,type)')
      .order('created_at', { ascending: false });
    fail(error);
    return { comments: (data || []).map((r: DbRow) => ({
      id: r.id, contentId: r.content_id, userId: r.user_id, body: r.body, createdAt: r.created_at,
      authorName: r.author?.display_name || 'Member', authorEmail: '',
      contentTitleEn: r.content?.title_en || '', contentTitleUr: r.content?.title_ur || '', contentType: r.content?.type || 'article',
    })) };
  },
  createContent: async (payload: {
    type: ContentType; status: ContentStatus; titleEn: string; titleUr: string;
    descriptionEn: string; descriptionUr: string; bodyEn: string; bodyUr: string;
    mediaUrl: string; thumbnailUrl: string; durationSec: number; tags: string[];
  }) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in.');
    const { data, error } = await supabase.from('content_items').insert({
      author_id: auth.user.id, ...contentFields(payload),
    }).select('*').single();
    fail(error);
    return { item: mapContent(data) };
  },
  updateContent: async (id: string, payload: Partial<{
    type: ContentType; status: ContentStatus; titleEn: string; titleUr: string;
    descriptionEn: string; descriptionUr: string; bodyEn: string; bodyUr: string;
    mediaUrl: string; thumbnailUrl: string; durationSec: number; tags: string[];
  }>) => {
    const { data, error } = await supabase.from('content_items').update(contentFields(payload as DbRow)).eq('id', id).select('*').single();
    fail(error);
    return { item: mapContent(data) };
  },
  deleteContent: async (id: string) => {
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    fail(error);
    return { ok: true };
  },
  updateSettings: async (payload: {
    siteNameEn: string; siteNameUr: string; logoText: string;
    ownerNameEn: string; ownerNameUr: string; aboutEn: string; aboutUr: string;
  }) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in.');
    const { row } = await getSettingsData();
    const values = {
      site_name: payload.siteNameEn, site_name_ur: payload.siteNameUr, logo_text: payload.logoText,
      about_text: payload.aboutEn, about_text_ur: payload.aboutUr, owner_id: auth.user.id,
    };
    const result = row
      ? await supabase.from('site_settings').update(values).eq('id', row.id)
      : await supabase.from('site_settings').insert(values);
    fail(result.error);
    const { settings } = await getSettingsData();
    settings.ownerNameEn = payload.ownerNameEn;
    settings.ownerNameUr = payload.ownerNameUr;
    return { settings };
  },
  analyzeContent: async (_contentId: string, _question: string, _lang: Language) => {
    throw new Error('AI analysis is not configured on this deployment yet.');
  },
};

export function uploadFileWithProgress(
  file: File, kind: 'video' | 'image', onProgress: (percent: number) => void,
): Promise<{ url: string; size: number; mimeType: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const { data: sessionData, error } = await supabase.auth.getSession();
      fail(error);
      if (!sessionData.session) throw new Error('Please sign in as an administrator to upload media.');
      const bucket = kind === 'video' ? 'videos' : 'images';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const objectPath = `${sessionData.session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('apikey', SUPABASE_PUBLISHABLE_KEY);
      xhr.setRequestHeader('Authorization', `Bearer ${sessionData.session.access_token}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
      };
      xhr.onerror = () => reject(new Error('Network error during media upload.'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let message = 'Media upload failed.';
          try { message = JSON.parse(xhr.responseText).message || message; } catch { /* ignore */ }
          reject(new Error(message));
          return;
        }
        onProgress(100);
        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        resolve({ url: data.publicUrl, size: file.size, mimeType: file.type });
      };
      xhr.send(file);
    } catch (error) { reject(error); }
  });
}
