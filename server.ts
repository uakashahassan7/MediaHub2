import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  db,
  getAdminStats,
  getContentItemById,
  getSiteSettings,
  hashPassword,
  initDatabase,
  listCommentsForContent,
  listContentItems,
  mapUserRow,
  verifyPassword,
} from './server/db.ts';
import {
  MAX_VIDEO_SIZE_BYTES,
  canAccessItem,
  computeReactionTransition,
  filterAndSortContent,
  parseTagsInput,
  validateCommentInput,
  validateContentInput,
  validateUploadFile,
} from './src/shared/contentLogic.ts';
import type {
  ContentStatus,
  ContentType,
  ReactionType,
  UserProfile,
} from './src/shared/types.ts';

initDatabase();

const UPLOADS_DIR = path.resolve('uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface AuthedRequest extends Request {
  user?: UserProfile;
}

const SESSION_COOKIE = 'mh_session';
const VIEW_COOKIE = 'mh_visitor';

function getUserFromRequest(req: Request): UserProfile | undefined {
  const token =
    req.cookies?.[SESSION_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) return undefined;

  const row = db
    .prepare(
      `
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
    `,
    )
    .get(token, new Date().toISOString()) as Record<string, unknown> | undefined;

  return row ? mapUserRow(row) : undefined;
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  req.user = getUserFromRequest(req);
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  next();
}

function createSessionCookie(res: Response, userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(token, userId, expires.toISOString(), now.toISOString());

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
  return token;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = ext || '.bin';
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
  },
});

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  // Serve static assets & uploaded media reliably
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/media', express.static(path.resolve('public/media')));
  app.use('/src/assets', express.static(path.resolve('src/assets')));

  // --- Auth Routes ---
  app.get('/api/auth/me', (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user ?? null });
  });

  app.post('/api/auth/signup', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const displayName = String(req.body?.displayName ?? '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (!displayName || displayName.length > 60) {
      res.status(400).json({ error: 'Please provide a display name (1-60 characters).' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const id = `usr-${crypto.randomUUID().slice(0, 12)}`;
    const createdAt = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO users (id, email, password_hash, display_name, role, bio, avatar_url, created_at)
      VALUES (?, ?, ?, ?, 'viewer', '', '', ?)
    `,
    ).run(id, email, hashPassword(password), displayName, createdAt);

    createSessionCookie(res, id);
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ user: mapUserRow(created) });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | Record<string, unknown>
      | undefined;

    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    createSessionCookie(res, String(userRow.id));
    res.json({ user: mapUserRow(userRow) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res: Response) => {
    const displayName = String(req.body?.displayName ?? '').trim();
    const bio = String(req.body?.bio ?? '').trim().slice(0, 300);

    if (!displayName || displayName.length > 60) {
      res.status(400).json({ error: 'Display name must be between 1 and 60 characters.' });
      return;
    }

    db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(
      displayName,
      bio,
      req.user!.id,
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<
      string,
      unknown
    >;
    res.json({ user: mapUserRow(updated) });
  });

  app.post('/api/auth/reset-request', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: string }
      | undefined;

    if (!userRow) {
      // Return generic success to avoid email enumeration while still indicating local flow
      res.json({
        message: 'If an account matches this email, a reset verification code has been issued.',
      });
      return;
    }

    const resetToken = crypto.randomInt(100000, 999999).toString();
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);
    db.prepare(
      `
      INSERT INTO password_resets (id, user_id, token, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `,
    ).run(`rst-${crypto.randomUUID().slice(0, 8)}`, userRow.id, resetToken, expires.toISOString(), now.toISOString());

    res.json({
      message: 'Verification code generated. Enter it below to set a new password.',
      demoResetCode: resetToken,
    });
  });

  app.post('/api/auth/reset-confirm', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');

    if (!email || !code || newPassword.length < 6) {
      res
        .status(400)
        .json({ error: 'Email, verification code, and a 6+ character password are required.' });
      return;
    }

    const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: string }
      | undefined;
    if (!userRow) {
      res.status(400).json({ error: 'Invalid email or reset code.' });
      return;
    }

    const resetRow = db
      .prepare(
        `
        SELECT id FROM password_resets
        WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1
      `,
      )
      .get(userRow.id, code, new Date().toISOString()) as { id: string } | undefined;

    if (!resetRow) {
      res.status(400).json({ error: 'Reset code is invalid or expired.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(newPassword),
      userRow.id,
    );
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);

    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  });

  // --- Public & Viewer Routes ---
  app.get('/api/settings', (req: AuthedRequest, res: Response) => {
    res.json({ settings: getSiteSettings(req.user?.id) });
  });

  app.get('/api/content', (req: AuthedRequest, res: Response) => {
    const role = req.user?.role ?? 'visitor';
    const includeDrafts = role === 'admin' && req.query.includeDrafts === '1';
    const type = (String(req.query.type ?? 'all') as ContentType | 'all');
    const query = String(req.query.q ?? '');

    const all = listContentItems({ includeDrafts, viewerUserId: req.user?.id });
    const filtered = filterAndSortContent(all, {
      type,
      query,
      role,
      includeDrafts,
    });

    res.json({ items: filtered });
  });

  app.get('/api/content/:id', (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const item = getContentItemById(id, req.user?.id);
    const role = req.user?.role ?? 'visitor';

    if (!item || !canAccessItem(item, role)) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    const published = listContentItems({ includeDrafts: false, viewerUserId: req.user?.id });
    const related = published
      .filter((other) => other.id !== item.id)
      .sort((a, b) => {
        const aOverlap = a.tags.filter((t) => item.tags.includes(t)).length;
        const bOverlap = b.tags.filter((t) => item.tags.includes(t)).length;
        if (bOverlap !== aOverlap) return bOverlap - aOverlap;
        if (a.type === item.type && b.type !== item.type) return -1;
        if (b.type === item.type && a.type !== item.type) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 6);

    const comments = listCommentsForContent(item.id);
    res.json({ item, related, comments });
  });

  app.post('/api/content/:id/view', (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const item = getContentItemById(id);
    const role = req.user?.role ?? 'visitor';

    if (!item || !canAccessItem(item, role)) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    let sessionKey = req.cookies?.[VIEW_COOKIE];
    if (!sessionKey) {
      sessionKey = crypto.randomUUID();
      res.cookie(VIEW_COOKIE, sessionKey, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    const existing = db
      .prepare('SELECT 1 FROM view_events WHERE session_key = ? AND content_id = ?')
      .get(sessionKey, id);

    if (!existing) {
      db.prepare('INSERT INTO view_events (session_key, content_id, created_at) VALUES (?, ?, ?)').run(
        sessionKey,
        id,
        new Date().toISOString(),
      );
      db.prepare('UPDATE content_items SET view_count = view_count + 1 WHERE id = ?').run(id);
    }

    const updated = getContentItemById(id, req.user?.id);
    res.json({ viewCount: updated?.viewCount ?? item.viewCount });
  });

  app.post('/api/content/:id/react', requireAuth, (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const nextType = req.body?.type as ReactionType;
    if (nextType !== 'like' && nextType !== 'dislike') {
      res.status(400).json({ error: 'Invalid reaction type.' });
      return;
    }

    const item = getContentItemById(id, req.user!.id);
    if (!item || !canAccessItem(item, req.user!.role)) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    const currentRow = db
      .prepare('SELECT type FROM reactions WHERE user_id = ? AND content_id = ?')
      .get(req.user!.id, id) as { type: ReactionType } | undefined;

    const transition = computeReactionTransition(currentRow?.type ?? null, nextType);

    db.exec('BEGIN');
    try {
      if (transition.nextReaction === null) {
        db.prepare('DELETE FROM reactions WHERE user_id = ? AND content_id = ?').run(
          req.user!.id,
          id,
        );
      } else if (!currentRow) {
        db.prepare(
          'INSERT INTO reactions (user_id, content_id, type, created_at) VALUES (?, ?, ?, ?)',
        ).run(req.user!.id, id, transition.nextReaction, new Date().toISOString());
      } else {
        db.prepare('UPDATE reactions SET type = ? WHERE user_id = ? AND content_id = ?').run(
          transition.nextReaction,
          req.user!.id,
          id,
        );
      }

      db.prepare(
        `
        UPDATE content_items
        SET likes_count = MAX(0, likes_count + ?),
            dislikes_count = MAX(0, dislikes_count + ?)
        WHERE id = ?
      `,
      ).run(transition.likeDelta, transition.dislikeDelta, id);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const updated = getContentItemById(id, req.user!.id)!;
    res.json({
      likesCount: updated.likesCount,
      dislikesCount: updated.dislikesCount,
      userReaction: updated.userReaction ?? null,
    });
  });

  app.post('/api/content/:id/comments', requireAuth, (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const body = String(req.body?.body ?? '');
    const validation = validateCommentInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message });
      return;
    }

    const item = getContentItemById(id);
    if (!item || !canAccessItem(item, req.user!.role)) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    const commentId = `cmt-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO comments (id, content_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(commentId, id, req.user!.id, body.trim(), now);

    const comments = listCommentsForContent(id);
    res.status(201).json({ comments });
  });

  app.delete('/api/comments/:commentId', requireAuth, (req: AuthedRequest, res: Response) => {
    const commentId = String(req.params.commentId);
    const existing = db
      .prepare('SELECT id, user_id, content_id FROM comments WHERE id = ?')
      .get(commentId) as { id: string; user_id: string; content_id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You may only delete your own comments.' });
      return;
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    const comments = listCommentsForContent(existing.content_id);
    res.json({ ok: true, comments });
  });

  app.post('/api/subscribe', requireAuth, (req: AuthedRequest, res: Response) => {
    const settings = getSiteSettings(req.user!.id);
    const existing = db
      .prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND owner_id = ?')
      .get(req.user!.id, settings.ownerId);

    if (existing) {
      db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND owner_id = ?').run(
        req.user!.id,
        settings.ownerId,
      );
    } else {
      db.prepare(
        'INSERT INTO subscriptions (subscriber_id, owner_id, created_at) VALUES (?, ?, ?)',
      ).run(req.user!.id, settings.ownerId, new Date().toISOString());
    }

    const updated = getSiteSettings(req.user!.id);
    res.json({
      subscribed: updated.isSubscribed,
      subscriberCount: updated.subscriberCount,
    });
  });

  // --- Admin Routes ---
  app.get('/api/admin/stats', requireAdmin, (_req: AuthedRequest, res: Response) => {
    res.json({ stats: getAdminStats() });
  });

  app.get('/api/admin/comments', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `
        SELECT cm.id, cm.content_id, cm.user_id, cm.body, cm.created_at,
               u.display_name AS author_name, u.email AS author_email,
               c.title_en AS content_title_en, c.title_ur AS content_title_ur, c.type AS content_type
        FROM comments cm
        JOIN users u ON u.id = cm.user_id
        JOIN content_items c ON c.id = cm.content_id
        ORDER BY cm.created_at DESC
      `,
      )
      .all() as Array<Record<string, unknown>>;

    res.json({
      comments: rows.map((r) => ({
        id: String(r.id),
        contentId: String(r.content_id),
        userId: String(r.user_id),
        body: String(r.body),
        createdAt: String(r.created_at),
        authorName: String(r.author_name),
        authorEmail: String(r.author_email),
        contentTitleEn: String(r.content_title_en ?? ''),
        contentTitleUr: String(r.content_title_ur ?? ''),
        contentType: String(r.content_type),
      })),
    });
  });

  app.post('/api/admin/upload', requireAdmin, (req: AuthedRequest, res: Response) => {
    uploadMiddleware.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'Uploaded file exceeds the 50 MB storage limit.',
            code: 'FILE_TOO_LARGE',
          });
          return;
        }
        res.status(400).json({ error: 'Upload failed. Please check the file and retry.' });
        return;
      }

      const file = req.file;
      const kind = req.body?.kind === 'video' ? 'video' : 'image';
      if (!file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const validation = validateUploadFile({
        sizeBytes: file.size,
        mimeType: file.mimetype,
        kind,
      });
      if (!validation.valid) {
        fs.unlink(file.path, () => {});
        res.status(validation.errorCode?.includes('EXCEEDED') ? 413 : 400).json({
          error: validation.message,
          code: validation.errorCode,
        });
        return;
      }

      res.status(201).json({
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
      });
    });
  });

  app.post('/api/admin/content', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body ?? {};
    const type = body.type as ContentType;
    const status: ContentStatus = body.status === 'draft' ? 'draft' : 'published';
    const titleEn = String(body.titleEn ?? '').trim();
    const titleUr = String(body.titleUr ?? '').trim();
    const descriptionEn = String(body.descriptionEn ?? '').trim();
    const descriptionUr = String(body.descriptionUr ?? '').trim();
    const bodyEn = String(body.bodyEn ?? '').trim();
    const bodyUr = String(body.bodyUr ?? '').trim();
    const mediaUrl = String(body.mediaUrl ?? '').trim();
    const thumbnailUrl = String(body.thumbnailUrl ?? '').trim();
    const durationSec = Math.max(0, Number(body.durationSec ?? 0) || 0);
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
      : parseTagsInput(String(body.tags ?? ''));

    const validation = validateContentInput({
      type,
      status,
      titleEn,
      titleUr,
      descriptionEn,
      descriptionUr,
      bodyEn,
      bodyUr,
      mediaUrl,
      thumbnailUrl,
    });

    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: validation.errorCode });
      return;
    }

    const id = `${type.slice(0, 3)}-${crypto.randomUUID().slice(0, 10)}`;
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO content_items (
        id, author_id, type, status, title_en, title_ur, description_en, description_ur,
        body_en, body_ur, media_url, thumbnail_url, duration_sec, tags,
        view_count, likes_count, dislikes_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `,
    ).run(
      id,
      req.user!.id,
      type,
      status,
      titleEn,
      titleUr,
      descriptionEn,
      descriptionUr,
      bodyEn,
      bodyUr,
      mediaUrl,
      thumbnailUrl || (type === 'image' ? mediaUrl : ''),
      durationSec,
      JSON.stringify(tags),
      now,
      now,
    );

    res.status(201).json({ item: getContentItemById(id, req.user!.id) });
  });

  app.patch('/api/admin/content/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = getContentItemById(id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    const body = req.body ?? {};
    const status: ContentStatus =
      body.status === 'draft' || body.status === 'published' ? body.status : existing.status;

    const nextData = {
      type: (body.type ?? existing.type) as ContentType,
      status,
      titleEn: body.titleEn !== undefined ? String(body.titleEn).trim() : existing.titleEn,
      titleUr: body.titleUr !== undefined ? String(body.titleUr).trim() : existing.titleUr,
      descriptionEn:
        body.descriptionEn !== undefined
          ? String(body.descriptionEn).trim()
          : existing.descriptionEn,
      descriptionUr:
        body.descriptionUr !== undefined
          ? String(body.descriptionUr).trim()
          : existing.descriptionUr,
      bodyEn: body.bodyEn !== undefined ? String(body.bodyEn).trim() : existing.bodyEn,
      bodyUr: body.bodyUr !== undefined ? String(body.bodyUr).trim() : existing.bodyUr,
      mediaUrl: body.mediaUrl !== undefined ? String(body.mediaUrl).trim() : existing.mediaUrl,
      thumbnailUrl:
        body.thumbnailUrl !== undefined
          ? String(body.thumbnailUrl).trim()
          : existing.thumbnailUrl,
      durationSec:
        body.durationSec !== undefined
          ? Math.max(0, Number(body.durationSec) || 0)
          : existing.durationSec,
      tags:
        body.tags !== undefined
          ? Array.isArray(body.tags)
            ? body.tags.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
            : parseTagsInput(String(body.tags))
          : existing.tags,
    };

    const validation = validateContentInput(nextData);
    if (!validation.valid) {
      res.status(400).json({ error: validation.message, code: validation.errorCode });
      return;
    }

    db.prepare(
      `
      UPDATE content_items
      SET type = ?, status = ?, title_en = ?, title_ur = ?,
          description_en = ?, description_ur = ?, body_en = ?, body_ur = ?,
          media_url = ?, thumbnail_url = ?, duration_sec = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(
      nextData.type,
      nextData.status,
      nextData.titleEn,
      nextData.titleUr,
      nextData.descriptionEn,
      nextData.descriptionUr,
      nextData.bodyEn,
      nextData.bodyUr,
      nextData.mediaUrl,
      nextData.thumbnailUrl,
      nextData.durationSec,
      JSON.stringify(nextData.tags),
      new Date().toISOString(),
      id,
    );

    res.json({ item: getContentItemById(id, req.user!.id) });
  });

  app.delete('/api/admin/content/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = getContentItemById(id);
    if (!existing) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }
    db.prepare('DELETE FROM content_items WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  app.patch('/api/admin/settings', requireAdmin, (req: AuthedRequest, res: Response) => {
    const current = getSiteSettings(req.user!.id);
    const body = req.body ?? {};
    const siteNameEn = String(body.siteNameEn ?? current.siteNameEn).trim();
    const siteNameUr = String(body.siteNameUr ?? current.siteNameUr).trim();
    const logoText = String(body.logoText ?? current.logoText).trim();
    const ownerNameEn = String(body.ownerNameEn ?? current.ownerNameEn).trim();
    const ownerNameUr = String(body.ownerNameUr ?? current.ownerNameUr).trim();
    const aboutEn = String(body.aboutEn ?? current.aboutEn).trim();
    const aboutUr = String(body.aboutUr ?? current.aboutUr).trim();

    if (!logoText || (!siteNameEn && !siteNameUr)) {
      res.status(400).json({ error: 'Logo text and site name are required.' });
      return;
    }

    db.prepare(
      `
      UPDATE site_settings
      SET site_name_en = ?, site_name_ur = ?, logo_text = ?,
          owner_name_en = ?, owner_name_ur = ?, about_en = ?, about_ur = ?, updated_at = ?
      WHERE id = 1
    `,
    ).run(
      siteNameEn || logoText,
      siteNameUr || logoText,
      logoText,
      ownerNameEn || current.ownerNameEn,
      ownerNameUr || current.ownerNameUr,
      aboutEn,
      aboutUr,
      new Date().toISOString(),
    );

    res.json({ settings: getSiteSettings(req.user!.id) });
  });

  // --- Optional Deep-Thinking Bilingual Analysis (gemini-4-carbon) ---
  app.post('/api/ai/analyze', async (req: AuthedRequest, res: Response) => {
    const contentId = String(req.body?.contentId ?? '');
    const question = String(req.body?.question ?? '').trim();
    const lang = req.body?.lang === 'ur' ? 'ur' : 'en';

    if (!question || question.length > 500) {
      res.status(400).json({ error: 'Please enter a concise question (1-500 characters).' });
      return;
    }

    const item = getContentItemById(contentId);
    if (!item || !canAccessItem(item, req.user?.role ?? 'visitor')) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'Gemini API key is not configured in Secrets for deep analysis.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const contextText = [
        `Type: ${item.type}`,
        `English Title: ${item.titleEn}`,
        `Urdu Title: ${item.titleUr}`,
        `English Description: ${item.descriptionEn}`,
        `Urdu Description: ${item.descriptionUr}`,
        item.bodyEn ? `English Body:\n${item.bodyEn}` : '',
        item.bodyUr ? `Urdu Body:\n${item.bodyUr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-carbon',
        contents: `Content Context:\n${contextText}\n\nReader Question:\n${question}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            lang === 'ur'
              ? 'You are a thoughtful editorial research assistant. Answer clearly and concisely in natural Urdu (maximum 180 words) grounded strictly in the provided content context.'
              : 'You are a thoughtful editorial research assistant. Answer clearly and concisely in English (maximum 180 words) grounded strictly in the provided content context.',
        },
      });

      res.json({ answer: response.text ?? '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate analysis.';
      res.status(500).json({ error: msg });
    }
  });

  // --- Vite / Production Static Hosting ---
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediaHub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediaHub server:', err);
  process.exit(1);
});
