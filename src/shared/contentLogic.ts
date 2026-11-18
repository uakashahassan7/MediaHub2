import type {
  ContentItem,
  ContentStatus,
  ContentType,
  Language,
  ReactionType,
  UserRole,
} from './types.ts';

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const MAX_COMMENT_LENGTH = 1000;

export interface ContentValidationInput {
  type: ContentType;
  status?: ContentStatus;
  titleEn?: string;
  titleUr?: string;
  descriptionEn?: string;
  descriptionUr?: string;
  bodyEn?: string;
  bodyUr?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  message?: string;
}

export function validateContentInput(input: ContentValidationInput): ValidationResult {
  if (!['video', 'image', 'article'].includes(input.type)) {
    return { valid: false, errorCode: 'INVALID_TYPE', message: 'Invalid content type.' };
  }

  const titleEn = (input.titleEn ?? '').trim();
  const titleUr = (input.titleUr ?? '').trim();

  if (!titleEn && !titleUr) {
    return {
      valid: false,
      errorCode: 'TITLE_REQUIRED',
      message: 'Please provide a title in English or Urdu.',
    };
  }

  const hasEnglishContent =
    titleEn.length > 0 &&
    ((input.descriptionEn ?? '').trim().length > 0 || (input.bodyEn ?? '').trim().length > 0);
  const hasUrduContent =
    titleUr.length > 0 &&
    ((input.descriptionUr ?? '').trim().length > 0 || (input.bodyUr ?? '').trim().length > 0);

  if (input.type === 'article' && !hasEnglishContent && !hasUrduContent) {
    return {
      valid: false,
      errorCode: 'ARTICLE_BODY_REQUIRED',
      message: 'Articles require body text in at least one filled language.',
    };
  }

  if (input.type === 'video' && !(input.mediaUrl ?? '').trim()) {
    return {
      valid: false,
      errorCode: 'VIDEO_MEDIA_REQUIRED',
      message: 'Please upload or provide a video file.',
    };
  }

  if (input.type === 'image' && !(input.mediaUrl ?? '').trim()) {
    return {
      valid: false,
      errorCode: 'IMAGE_MEDIA_REQUIRED',
      message: 'Please upload or provide an image file.',
    };
  }

  return { valid: true };
}

export function validateCommentInput(rawBody: string): ValidationResult {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      errorCode: 'COMMENT_EMPTY',
      message: 'Comment cannot be empty.',
    };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return {
      valid: false,
      errorCode: 'COMMENT_TOO_LONG',
      message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
    };
  }
  return { valid: true };
}

export function validateUploadFile(params: {
  sizeBytes: number;
  mimeType: string;
  kind: 'video' | 'image';
}): ValidationResult {
  const { sizeBytes, mimeType, kind } = params;
  if (sizeBytes <= 0) {
    return { valid: false, errorCode: 'EMPTY_FILE', message: 'Uploaded file is empty.' };
  }

  if (kind === 'video') {
    if (!mimeType.startsWith('video/')) {
      return {
        valid: false,
        errorCode: 'INVALID_VIDEO_MIME',
        message: 'Only standard video files (MP4, WebM, MOV) are supported.',
      };
    }
    if (sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      return {
        valid: false,
        errorCode: 'VIDEO_SIZE_EXCEEDED',
        message: 'Video file exceeds the 50 MB upload limit.',
      };
    }
  } else {
    if (!mimeType.startsWith('image/')) {
      return {
        valid: false,
        errorCode: 'INVALID_IMAGE_MIME',
        message: 'Only standard image files (JPG, PNG, WebP) are supported.',
      };
    }
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        errorCode: 'IMAGE_SIZE_EXCEEDED',
        message: 'Image file exceeds the 10 MB upload limit.',
      };
    }
  }

  return { valid: true };
}

export function getLocalizedContent(
  item: ContentItem,
  lang: Language,
): {
  title: string;
  description: string;
  body: string;
  isFallback: boolean;
} {
  if (lang === 'ur') {
    const title = item.titleUr.trim() || item.titleEn.trim();
    const description = item.descriptionUr.trim() || item.descriptionEn.trim();
    const body = item.bodyUr.trim() || item.bodyEn.trim();
    const isFallback = !item.titleUr.trim();
    return { title, description, body, isFallback };
  }

  const title = item.titleEn.trim() || item.titleUr.trim();
  const description = item.descriptionEn.trim() || item.descriptionUr.trim();
  const body = item.bodyEn.trim() || item.bodyUr.trim();
  const isFallback = !item.titleEn.trim();
  return { title, description, body, isFallback };
}

export function computeReactionTransition(
  current: ReactionType | null | undefined,
  next: ReactionType,
): {
  nextReaction: ReactionType | null;
  likeDelta: number;
  dislikeDelta: number;
} {
  if (current === next) {
    // Toggle off
    return {
      nextReaction: null,
      likeDelta: next === 'like' ? -1 : 0,
      dislikeDelta: next === 'dislike' ? -1 : 0,
    };
  }

  if (!current) {
    return {
      nextReaction: next,
      likeDelta: next === 'like' ? 1 : 0,
      dislikeDelta: next === 'dislike' ? 1 : 0,
    };
  }

  // Switch from like -> dislike or dislike -> like
  return {
    nextReaction: next,
    likeDelta: next === 'like' ? 1 : -1,
    dislikeDelta: next === 'dislike' ? 1 : -1,
  };
}

export function canAccessItem(item: Pick<ContentItem, 'status'>, role: UserRole): boolean {
  if (item.status === 'published') return true;
  return role === 'admin';
}

export function filterAndSortContent(
  items: ContentItem[],
  options: {
    type?: ContentType | 'all';
    query?: string;
    role?: UserRole;
    includeDrafts?: boolean;
  },
): ContentItem[] {
  const role = options.role ?? 'visitor';
  const showDrafts = role === 'admin' && Boolean(options.includeDrafts);
  const query = (options.query ?? '').trim().toLowerCase();
  const type = options.type ?? 'all';

  return items
    .filter((item) => {
      if (!showDrafts && item.status !== 'published') return false;
      if (type !== 'all' && item.type !== type) return false;
      if (!query) return true;
      const haystack = [
        item.titleEn,
        item.titleUr,
        item.descriptionEn,
        item.descriptionUr,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function parseTagsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 32),
    ),
  ).slice(0, 10);
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:08';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 140));
}
