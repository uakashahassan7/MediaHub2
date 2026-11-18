import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminStats,
  ContentComment,
  ContentItem,
  ContentStatus,
  ContentType,
  ReactionType,
  SiteSettings,
  UserProfile,
} from '../src/shared/types.ts';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(path.join(DATA_DIR, 'mediahub.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHex] = storedHash.split(':');
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'admin')),
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_name_en TEXT NOT NULL,
      site_name_ur TEXT NOT NULL,
      logo_text TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      owner_name_en TEXT NOT NULL,
      owner_name_ur TEXT NOT NULL,
      owner_avatar TEXT NOT NULL,
      about_en TEXT NOT NULL,
      about_ur TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('video', 'image', 'article')),
      status TEXT NOT NULL CHECK (status IN ('published', 'draft')),
      title_en TEXT NOT NULL DEFAULT '',
      title_ur TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      description_ur TEXT NOT NULL DEFAULT '',
      body_en TEXT NOT NULL DEFAULT '',
      body_ur TEXT NOT NULL DEFAULT '',
      media_url TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      view_count INTEGER NOT NULL DEFAULT 0,
      likes_count INTEGER NOT NULL DEFAULT 0,
      dislikes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reactions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('like', 'dislike')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, content_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      subscriber_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (subscriber_id, owner_id)
    );

    CREATE TABLE IF NOT EXISTS view_events (
      session_key TEXT NOT NULL,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (session_key, content_id)
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (countRow.count === 0) {
    seedDatabase();
  }
}

function seedDatabase(): void {
  const now = new Date('2026-11-12T10:00:00.000Z');
  const isoOffset = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const adminId = 'owner-tariq';
  const viewer1Id = 'viewer-amina';
  const viewer2Id = 'viewer-bilal';
  const viewer3Id = 'viewer-sana';

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, role, bio, avatar_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    adminId,
    'admin@mediahub.local',
    hashPassword('Admin123!'),
    'Tariq Mahmood',
    'admin',
    'Independent documentary filmmaker, photographer, and bilingual essayist.',
    '/src/assets/images/channel_owner_avatar_1794514245333.jpg',
    isoOffset(90),
  );
  insertUser.run(
    viewer1Id,
    'viewer@mediahub.local',
    hashPassword('Viewer123!'),
    'Amina Khan',
    'viewer',
    'Reader and documentary film enthusiast.',
    '',
    isoOffset(45),
  );
  insertUser.run(
    viewer2Id,
    'bilal@mediahub.local',
    hashPassword('Viewer123!'),
    'Bilal Raza',
    'viewer',
    'Architectural photography follower.',
    '',
    isoOffset(30),
  );
  insertUser.run(
    viewer3Id,
    'sana@mediahub.local',
    hashPassword('Viewer123!'),
    'Sana Siddiqui',
    'viewer',
    'Urdu literature and design reader.',
    '',
    isoOffset(20),
  );

  db.prepare(`
    INSERT INTO site_settings (
      id, site_name_en, site_name_ur, logo_text, owner_id, owner_name_en, owner_name_ur, owner_avatar, about_en, about_ur, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'MediaHub',
    'میڈیا ہب',
    'MediaHub',
    adminId,
    'Tariq Mahmood',
    'طارق محمود',
    '/src/assets/images/channel_owner_avatar_1794514245333.jpg',
    'MediaHub is an independent bilingual journal and screening room publishing original short documentaries, photographic essays, and long-form cultural writing in English and Urdu.',
    'میڈیا ہب ایک آزاد دو لسانی اشاعتی اور بصری پلیٹ فارم ہے جہاں دستاویزی فلمیں، فوٹوگرافی اور اردو و انگریزی میں فکری مضامین شائع کیے جاتے ہیں۔',
    isoOffset(1),
  );

  const insertContent = db.prepare(`
    INSERT INTO content_items (
      id, author_id, type, status, title_en, title_ur, description_en, description_ur,
      body_en, body_ur, media_url, thumbnail_url, duration_sec, tags,
      view_count, likes_count, dislikes_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertContent.run(
    'vid-lahore-courtyards',
    adminId,
    'video',
    'published',
    "Shadows of Sandstone: Inside Lahore's Walled Courtyards",
    'سنگِ سرخ کے سائے: لاہور کی قدیم حویلیوں کا سفر',
    'A quiet visual study of afternoon light, carved wooden jharokhas, and acoustic calm inside historic Walled City courtyards.',
    'اندرون لاہور کی تاریخی حویلیوں میں سہ پہر کی روشنی، لکڑی کے جھروکوں اور پرانے آنگنوں کے سکون پر ایک مختصر دستاویزی فلم۔',
    '',
    '',
    '/media/lahore_courtyards.mp4',
    '/src/assets/images/video_thumb_lahore_1794514246142.jpg',
    482,
    JSON.stringify(['architecture', 'lahore', 'documentary']),
    1842,
    146,
    3,
    isoOffset(2),
    isoOffset(2),
  );

  insertContent.run(
    'vid-studio-soundcraft',
    adminId,
    'video',
    'published',
    'Sculpting Silence: Analog Sound Design for Short Film',
    'خاموشی کی تشکیل: مختصر فلموں کے لیے ساؤنڈ ڈیزائن',
    'How room tone, tape warmth, and field ambience shape emotional pacing in non-fiction filmmaking.',
    'دستاویزی فلموں میں ماحولیاتی آوازوں، اینالاگ ٹیپ اور خاموشی کے وقفوں سے کہانی میں گہرائی پیدا کرنے کا عملی جائزہ۔',
    '',
    '',
    '/media/studio_soundcraft.mp4',
    '/src/assets/images/video_thumb_studio_1794514247284.jpg',
    615,
    JSON.stringify(['filmmaking', 'audio', 'studio']),
    964,
    89,
    2,
    isoOffset(5),
    isoOffset(5),
  );

  insertContent.run(
    'img-karakoram-dawn',
    adminId,
    'image',
    'published',
    'First Light Over the Karakoram Stone Terraces',
    'قراقرم کی پتھریلی ڈھلوانوں پر صبحِ اوّل',
    'Shot on 35mm monochrome film at 3,200 meters just as hearth smoke rises above stone-built mountain terraces.',
    'تین ہزار دو سو میٹر کی بلندی پر طلوعِ آفتاب کے وقت پتھر سے بنے پہاڑی کھیتوں اور بستیوں کی بلیک اینڈ وائٹ عکاسی۔',
    '',
    '',
    '/src/assets/images/image_post_karakoram_1794514246742.jpg',
    '/src/assets/images/image_post_karakoram_1794514246742.jpg',
    0,
    JSON.stringify(['photography', 'karakoram', 'monochrome']),
    731,
    112,
    1,
    isoOffset(4),
    isoOffset(4),
  );

  insertContent.run(
    'img-reed-qalam',
    adminId,
    'image',
    'published',
    'The Reed Pen: Notes on Hand-Carved Qalam Craft',
    'قلم تراشی: ہاتھ سے بنے بانس کے قلم اور روشنائی',
    'Before a single Nastaliq stroke meets cotton rag paper, the angle of the bamboo nib decides the rhythm of every letter.',
    'کاغذ پر خطِ نستعلیق کا پہلا حرف لکھنے سے پہلے بانس کے قلم کا قط ہر لفظ کی روانی اور توازن کا تعین کرتا ہے۔',
    '',
    '',
    '/src/assets/images/image_post_calligraphy_1794514247012.jpg',
    '/src/assets/images/image_post_calligraphy_1794514247012.jpg',
    0,
    JSON.stringify(['calligraphy', 'craft', 'urdu']),
    618,
    94,
    0,
    isoOffset(7),
    isoOffset(7),
  );

  insertContent.run(
    'art-bilingual-typography',
    adminId,
    'article',
    'published',
    'Designing Bilingual Archives: Why Urdu & English Must Share the Grid',
    'دو لسانی اشاعت: اردو اور انگریزی ٹائپوگرافی کا توازن',
    'Reflections on building digital reading spaces where right-to-left Urdu prose and left-to-right English essays feel equally native.',
    'ڈیجیٹل اشاعت میں دائیں سے بائیں اردو اور بائیں سے دائیں انگریزی تحریر کو یکساں وقار اور سہولت کے ساتھ پیش کرنے کے اصول۔',
    `Digital archives across South Asia often treat Urdu as an afterthought—squeezed into cramped left-aligned boxes with mismatched system fonts. Yet when a publication is genuinely bilingual, both scripts deserve equal typographic dignity.

In our studio workflow, every story begins with two parallel notebooks: one written in English, the other drafted natively in Urdu rather than mechanically translated. Ideas carry different cadences in each language. A sentence about sandstone shadows in Lahore asks for spacious pauses in Urdu that differ from English prose rhythm.

Three practical rules guide our editorial grid:
1. Respect directional flow completely. Switching to Urdu must mirror navigation, margins, and reading alignment so the eye never fights the interface.
2. Pair line heights generously. Arabic and Urdu glyphs carry vertical ascenders and descenders that need room to breathe—never compress Urdu body copy to tight Latin line metrics.
3. Keep metadata quiet. Titles, author notes, and visual frames should invite unhurried reading rather than competing with badges and chrome.`,
    `جنوبی ایشیا کے ڈیجیٹل پلیٹ فارمز پر اردو زبان کو اکثر ثانوی حیثیت دی جاتی ہے، جہاں ٹوٹے ہوئے حروف اور تنگ سطروں کے باعث مطالعہ مشکل ہو جاتا ہے۔ حالانکہ ایک حقیقی دو لسانی اشاعت میں دونوں زبانوں کو یکساں توجہ اور جمالیاتی توازن ملنا چاہیے۔

ہمارے اسٹوڈیو میں ہر مضمون اور دستاویزی کہانی دو متوازی کاپیوں میں لکھی جاتی ہے۔ محض لفظی ترجمے کے بجائے اردو تحریر کو اس کے اپنے فطری مزاج اور روانی کے ساتھ ترتیب دیا جاتا ہے، کیونکہ ہر زبان کا اپنا آہنگ اور بیان کا انداز ہوتا ہے۔

اس اشاعتی نظام میں تین بنیادی اصول پیشِ نظر رکھے جاتے ہیں:
1. سمتِ تحریر کا مکمل احترام: اردو موڈ میں پورا صفحہ دائیں سے بائیں ترتیب پاتا ہے تاکہ قاری کی نظر فطری انداز میں سفر کرے۔
2. سطروں کے درمیان مناسب فاصلہ: اردو حروف کے شوشوں اور اعراب کی وضاحت کے لیے کھلا لائن اسپیس ضروری ہے۔
3. سادگی اور وقار: مضمون کے گرد غیر ضروری بصری شور کے بجائے متن اور تصویر کو مرکزی حیثیت دی جائے۔`,
    '',
    '/src/assets/images/article_cover_typography_1794514247723.jpg',
    0,
    JSON.stringify(['typography', 'editorial', 'urdu']),
    1120,
    134,
    2,
    isoOffset(3),
    isoOffset(3),
  );

  insertContent.run(
    'art-field-recording-notes',
    adminId,
    'article',
    'published',
    'Notes From Field Recording in Northern Mountain Valleys',
    'شمالی وادیوں میں فیلڈ ریکارڈنگ کی یادداشتیں',
    'Listening before filming: what three weeks with only a stereo microphone and notebook taught us about place.',
    'کیمرہ نکالنے سے پہلے سننے کی مشق: پہاڑی وادیوں میں تین ہفتے صرف مائیکروفون اور ڈائری کے ساتھ گزارنے کا تجربہ۔',
    `When you leave the camera inside its bag for the first forty-eight hours in a new valley, your attention shifts from framing shots to noticing distance, wind, and daily routines.

At dawn in upper Hunza, sound travels across terraced ridges with startling clarity: wooden shutters unlatching, meltwater channels rising after noon sun, and distant footfalls on stone paths. Recording these layers separately before filming transforms how an edit breathes later in the studio.

Every landscape has an acoustic signature that photographs alone cannot preserve.`,
    `جب آپ کسی نئی وادی میں پہنچ کر پہلے اڑتالیس گھنٹے کیمرہ بیگ ہی میں رہنے دیتے ہیں تو آپ کی توجہ مناظر کے بجائے آوازوں، ہوا کے رخ اور روزمرہ زندگی کی خاموش لے پر مرکوز ہو جاتی ہے۔

صبح سویرے پہاڑی بستیوں میں لکڑی کے دروازے کھلنے، برفانی نالوں کے بہاؤ اور پتھریلی پگڈنڈیوں پر قدموں کی چاپ دور تک سنائی دیتی ہے۔ فلم بندی سے پہلے ان آوازوں کو ریکارڈ کرنا بعد میں ایڈیٹنگ کی روح بن جاتا ہے۔`,
    '',
    '',
    0,
    JSON.stringify(['fieldnotes', 'audio', 'essay']),
    415,
    58,
    0,
    isoOffset(9),
    isoOffset(9),
  );

  insertContent.run(
    'art-draft-autumn-monograph',
    adminId,
    'article',
    'draft',
    'Upcoming Autumn Monograph: Visual Storytelling Series',
    'آئندہ خزاں کا خصوصی شمارہ: بصری کہانی گوئی',
    'Internal working draft outlining our winter documentary essays and archival print plates.',
    'آئندہ موسمِ خزاں کے خصوصی شمارے اور نئی دستاویزی سیریز کا ابتدائی مسودہ۔',
    'Working outline for the upcoming quarterly monograph covering courtyard architecture, analog darkroom notes, and Urdu literary journals.',
    'آئندہ سہ ماہی شمارے کی منصوبہ بندی اور مضامین کا ابتدائی خاکہ۔',
    '',
    '',
    0,
    JSON.stringify(['monograph', 'draft']),
    0,
    0,
    0,
    isoOffset(0),
    isoOffset(0),
  );

  const insertComment = db.prepare(`
    INSERT INTO comments (id, content_id, user_id, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertComment.run(
    'cmt-1',
    'vid-lahore-courtyards',
    viewer1Id,
    'The golden hour framing on the carved sandstone arches is extraordinary. Looking forward to part two!',
    isoOffset(1),
  );
  insertComment.run(
    'cmt-2',
    'vid-lahore-courtyards',
    viewer2Id,
    'لاہور کی حویلیوں کا سکون اور روشنی بہت خوبصورتی سے محفوظ کی گئی ہے۔',
    isoOffset(1),
  );
  insertComment.run(
    'cmt-3',
    'art-bilingual-typography',
    viewer3Id,
    'Finally a platform where switching to Urdu RTL feels genuinely well-proportioned instead of cramped.',
    isoOffset(2),
  );

  const insertReaction = db.prepare(`
    INSERT INTO reactions (user_id, content_id, type, created_at) VALUES (?, ?, ?, ?)
  `);
  insertReaction.run(viewer1Id, 'vid-lahore-courtyards', 'like', isoOffset(1));
  insertReaction.run(viewer2Id, 'art-bilingual-typography', 'like', isoOffset(2));

  const insertSub = db.prepare(`
    INSERT INTO subscriptions (subscriber_id, owner_id, created_at) VALUES (?, ?, ?)
  `);
  insertSub.run(viewer1Id, adminId, isoOffset(15));
  insertSub.run(viewer2Id, adminId, isoOffset(10));
  insertSub.run(viewer3Id, adminId, isoOffset(5));
}

export function mapUserRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role === 'admin' ? 'admin' : 'viewer',
    bio: String(row.bio ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    createdAt: String(row.created_at),
  };
}

export function getSiteSettings(viewerUserId?: string): SiteSettings {
  const row = db.prepare('SELECT * FROM site_settings WHERE id = 1').get() as Record<string, unknown>;
  const subCount = (
    db
      .prepare('SELECT COUNT(*) AS count FROM subscriptions WHERE owner_id = ?')
      .get(String(row.owner_id)) as { count: number }
  ).count;

  let isSubscribed = false;
  if (viewerUserId) {
    const subRow = db
      .prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND owner_id = ?')
      .get(viewerUserId, String(row.owner_id));
    isSubscribed = Boolean(subRow);
  }

  return {
    siteNameEn: String(row.site_name_en),
    siteNameUr: String(row.site_name_ur),
    logoText: String(row.logo_text),
    ownerId: String(row.owner_id),
    ownerNameEn: String(row.owner_name_en),
    ownerNameUr: String(row.owner_name_ur),
    ownerAvatar: String(row.owner_avatar),
    aboutEn: String(row.about_en),
    aboutUr: String(row.about_ur),
    subscriberCount: subCount,
    isSubscribed,
  };
}

export function mapContentRow(
  row: Record<string, unknown>,
  viewerUserId?: string,
): ContentItem {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }

  let userReaction: ReactionType | null = null;
  if (viewerUserId) {
    const reactionRow = db
      .prepare('SELECT type FROM reactions WHERE user_id = ? AND content_id = ?')
      .get(viewerUserId, String(row.id)) as { type: ReactionType } | undefined;
    if (reactionRow) userReaction = reactionRow.type;
  }

  return {
    id: String(row.id),
    authorId: String(row.author_id),
    type: row.type as ContentType,
    status: row.status as ContentStatus,
    titleEn: String(row.title_en ?? ''),
    titleUr: String(row.title_ur ?? ''),
    descriptionEn: String(row.description_en ?? ''),
    descriptionUr: String(row.description_ur ?? ''),
    bodyEn: String(row.body_en ?? ''),
    bodyUr: String(row.body_ur ?? ''),
    mediaUrl: String(row.media_url ?? ''),
    thumbnailUrl: String(row.thumbnail_url ?? ''),
    durationSec: Number(row.duration_sec ?? 0),
    tags,
    viewCount: Number(row.view_count ?? 0),
    likesCount: Number(row.likes_count ?? 0),
    dislikesCount: Number(row.dislikes_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    userReaction,
  };
}

export function listContentItems(options: {
  includeDrafts: boolean;
  viewerUserId?: string;
}): ContentItem[] {
  const whereClause = options.includeDrafts ? '' : "WHERE c.status = 'published'";
  const rows = db
    .prepare(
      `
      SELECT c.*, (SELECT COUNT(*) FROM comments cm WHERE cm.content_id = c.id) AS comment_count
      FROM content_items c
      ${whereClause}
      ORDER BY c.created_at DESC
    `,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => mapContentRow(row, options.viewerUserId));
}

export function getContentItemById(id: string, viewerUserId?: string): ContentItem | null {
  const row = db
    .prepare(
      `
      SELECT c.*, (SELECT COUNT(*) FROM comments cm WHERE cm.content_id = c.id) AS comment_count
      FROM content_items c
      WHERE c.id = ?
    `,
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!row) return null;
  return mapContentRow(row, viewerUserId);
}

export function listCommentsForContent(contentId: string): ContentComment[] {
  const rows = db
    .prepare(
      `
      SELECT cm.id, cm.content_id, cm.user_id, cm.body, cm.created_at,
             u.display_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
      FROM comments cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.content_id = ?
      ORDER BY cm.created_at DESC
    `,
    )
    .all(contentId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    contentId: String(row.content_id),
    userId: String(row.user_id),
    authorName: String(row.author_name),
    authorAvatar: String(row.author_avatar ?? ''),
    authorRole: row.author_role === 'admin' ? 'admin' : 'viewer',
    body: String(row.body),
    createdAt: String(row.created_at),
  }));
}

export function getAdminStats(): AdminStats {
  const summary = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_items,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_items,
        SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) AS video_count,
        SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) AS image_count,
        SUM(CASE WHEN type = 'article' THEN 1 ELSE 0 END) AS article_count,
        COALESCE(SUM(view_count), 0) AS total_views
      FROM content_items
    `,
    )
    .get() as Record<string, number>;

  const subRow = db.prepare('SELECT COUNT(*) AS count FROM subscriptions').get() as { count: number };
  const cmtRow = db.prepare('SELECT COUNT(*) AS count FROM comments').get() as { count: number };

  return {
    totalItems: Number(summary.total_items ?? 0),
    publishedItems: Number(summary.published_items ?? 0),
    draftItems: Number(summary.draft_items ?? 0),
    videoCount: Number(summary.video_count ?? 0),
    imageCount: Number(summary.image_count ?? 0),
    articleCount: Number(summary.article_count ?? 0),
    totalViews: Number(summary.total_views ?? 0),
    subscriberCount: Number(subRow.count ?? 0),
    commentCount: Number(cmtRow.count ?? 0),
  };
}
