import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  canAccessItem,
  computeReactionTransition,
  filterAndSortContent,
  formatCompactCount,
  formatDuration,
  getLocalizedContent,
  parseTagsInput,
  validateCommentInput,
  validateContentInput,
  validateUploadFile,
} from './contentLogic.ts';
import type { ContentItem } from './types.ts';

const baseItem: ContentItem = {
  id: 'item-1',
  authorId: 'admin-1',
  type: 'article',
  status: 'published',
  titleEn: 'Architecture of Courtyards',
  titleUr: 'حویلیوں کا فنِ تعمیر',
  descriptionEn: 'An essay on sandstone light.',
  descriptionUr: 'سنگِ سرخ اور روشنی پر مضمون۔',
  bodyEn: 'Full English essay body here.',
  bodyUr: 'اردو مضمون کا مکمل متن۔',
  mediaUrl: '',
  thumbnailUrl: '/thumb.jpg',
  durationSec: 0,
  tags: ['architecture', 'lahore'],
  viewCount: 120,
  likesCount: 10,
  dislikesCount: 1,
  commentCount: 2,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};

test('validateContentInput enforces at least one language title and type-specific media', () => {
  assert.equal(validateContentInput({ type: 'image', titleEn: '', titleUr: '' }).valid, false);
  assert.equal(
    validateContentInput({ type: 'video', titleEn: 'Clip', mediaUrl: '' }).errorCode,
    'VIDEO_MEDIA_REQUIRED',
  );
  assert.equal(
    validateContentInput({ type: 'article', titleUr: 'صرف عنوان' }).errorCode,
    'ARTICLE_BODY_REQUIRED',
  );
  assert.equal(
    validateContentInput({
      type: 'article',
      titleUr: 'اردو مضمون',
      bodyUr: 'تفصیلی متن یہاں درج ہے۔',
    }).valid,
    true,
  );
});

test('validateCommentInput enforces 1..1000 plain text bounds', () => {
  assert.equal(validateCommentInput('   ').valid, false);
  assert.equal(validateCommentInput('a'.repeat(1001)).valid, false);
  assert.equal(validateCommentInput('Great documentary!').valid, true);
});

test('validateUploadFile enforces mime and storage limits', () => {
  assert.equal(
    validateUploadFile({ sizeBytes: MAX_VIDEO_SIZE_BYTES + 1, mimeType: 'video/mp4', kind: 'video' })
      .errorCode,
    'VIDEO_SIZE_EXCEEDED',
  );
  assert.equal(
    validateUploadFile({ sizeBytes: MAX_IMAGE_SIZE_BYTES + 1, mimeType: 'image/jpeg', kind: 'image' })
      .errorCode,
    'IMAGE_SIZE_EXCEEDED',
  );
  assert.equal(
    validateUploadFile({ sizeBytes: 1024, mimeType: 'application/pdf', kind: 'image' }).errorCode,
    'INVALID_IMAGE_MIME',
  );
  assert.equal(
    validateUploadFile({ sizeBytes: 512_000, mimeType: 'video/mp4', kind: 'video' }).valid,
    true,
  );
});

test('computeReactionTransition toggles and switches cleanly', () => {
  assert.deepEqual(computeReactionTransition(null, 'like'), {
    nextReaction: 'like',
    likeDelta: 1,
    dislikeDelta: 0,
  });
  assert.deepEqual(computeReactionTransition('like', 'like'), {
    nextReaction: null,
    likeDelta: -1,
    dislikeDelta: 0,
  });
  assert.deepEqual(computeReactionTransition('like', 'dislike'), {
    nextReaction: 'dislike',
    likeDelta: -1,
    dislikeDelta: 1,
  });
});

test('getLocalizedContent falls back cleanly when one language is absent', () => {
  const urduOnly: ContentItem = {
    ...baseItem,
    titleEn: '',
    descriptionEn: '',
    bodyEn: '',
  };
  const enResult = getLocalizedContent(urduOnly, 'en');
  assert.equal(enResult.title, 'حویلیوں کا فنِ تعمیر');
  assert.equal(enResult.isFallback, true);

  const urResult = getLocalizedContent(baseItem, 'ur');
  assert.equal(urResult.title, 'حویلیوں کا فنِ تعمیر');
  assert.equal(urResult.isFallback, false);
});

test('filterAndSortContent enforces draft visibility by role and bilingual search', () => {
  const draftItem: ContentItem = {
    ...baseItem,
    id: 'draft-1',
    status: 'draft',
    titleEn: 'Draft Secret Essay',
    createdAt: '2026-11-12T10:00:00.000Z',
  };
  const videoItem: ContentItem = {
    ...baseItem,
    id: 'video-1',
    type: 'video',
    titleEn: 'Lahore Soundscape',
    titleUr: 'لاہور کی آوازیں',
    descriptionEn: 'Audio field documentary.',
    descriptionUr: 'آڈیو دستاویزی فلم۔',
    tags: ['audio', 'pakistan'],
    createdAt: '2026-11-11T10:00:00.000Z',
  };

  const publicList = filterAndSortContent([baseItem, draftItem, videoItem], {
    role: 'viewer',
    includeDrafts: true,
  });
  assert.deepEqual(
    publicList.map((i) => i.id),
    ['video-1', 'item-1'],
  );

  const adminList = filterAndSortContent([baseItem, draftItem, videoItem], {
    role: 'admin',
    includeDrafts: true,
  });
  assert.deepEqual(
    adminList.map((i) => i.id),
    ['draft-1', 'video-1', 'item-1'],
  );

  const searchResult = filterAndSortContent([baseItem, draftItem, videoItem], {
    role: 'visitor',
    query: 'سنگِ سرخ',
  });
  assert.deepEqual(
    searchResult.map((i) => i.id),
    ['item-1'],
  );

  assert.equal(canAccessItem(draftItem, 'viewer'), false);
  assert.equal(canAccessItem(draftItem, 'admin'), true);
});

test('formatting helpers return expected outputs', () => {
  assert.equal(formatDuration(482), '8:02');
  assert.equal(formatCompactCount(1500), '1.5K');
  assert.deepEqual(parseTagsInput('Urdu, Design, urdu, Film '), ['urdu', 'design', 'film']);
});
