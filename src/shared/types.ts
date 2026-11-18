export type Language = 'en' | 'ur';
export type ThemeMode = 'light' | 'dark';
export type UserRole = 'visitor' | 'viewer' | 'admin';
export type ContentType = 'video' | 'image' | 'article';
export type ContentStatus = 'published' | 'draft';
export type ReactionType = 'like' | 'dislike';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Exclude<UserRole, 'visitor'>;
  bio: string;
  avatarUrl: string;
  createdAt: string;
}

export interface SiteSettings {
  siteNameEn: string;
  siteNameUr: string;
  logoText: string;
  ownerId: string;
  ownerNameEn: string;
  ownerNameUr: string;
  ownerAvatar: string;
  aboutEn: string;
  aboutUr: string;
  subscriberCount: number;
  isSubscribed: boolean;
}

export interface ContentItem {
  id: string;
  authorId: string;
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
  viewCount: number;
  likesCount: number;
  dislikesCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  userReaction?: ReactionType | null;
}

export interface ContentComment {
  id: string;
  contentId: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: Exclude<UserRole, 'visitor'>;
  body: string;
  createdAt: string;
}

export interface AdminStats {
  totalItems: number;
  publishedItems: number;
  draftItems: number;
  videoCount: number;
  imageCount: number;
  articleCount: number;
  totalViews: number;
  subscriberCount: number;
  commentCount: number;
}
