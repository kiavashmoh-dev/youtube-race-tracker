import { hashPassword, signSession, verifySession, parseCookie } from './lib/auth.js';
import { parseVideoId } from './lib/parseUrl.js';
import { fetchOembed } from './lib/oembed.js';
import { scoreVideo } from './lib/score.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_S = 60 * 60; // 1 hour

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env, cors);
    }

    // All routes below require auth.
    if (url.pathname.startsWith('/api/')) {
      if (!(await requireAuth(request, env))) {
        return json({ error: 'unauthorized' }, 401, cors);
      }
    }

    if (url.pathname === '/api/uploads' && request.method === 'GET') {
      return handleListUploads(env, cors);
    }

    if (url.pathname === '/api/uploads' && request.method === 'POST') {
      return handleCreateUpload(request, env, cors);
    }

    const deleteMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      return handleDeleteUpload(deleteMatch[1], url.searchParams.get('user'), env, cors);
    }

    const rescoreMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)\/rescore$/);
    if (rescoreMatch && request.method === 'POST') {
      return handleRescore(rescoreMatch[1], url.searchParams.get('user'), env, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },
};

async function handleLogin(request, env, cors) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `ratelimit:login:${ip}`;
  const current = Number((await env.UPLOADS_KV.get(rlKey)) ?? 0);
  if (current >= LOGIN_LIMIT) {
    return json({ error: 'too many attempts' }, 429, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400, cors);
  }
  if (!body?.password || typeof body.password !== 'string') {
    return json({ error: 'password required' }, 400, cors);
  }

  const submitted = await hashPassword(body.password);
  if (submitted !== env.SHARED_PASSWORD_HASH) {
    await env.UPLOADS_KV.put(rlKey, String(current + 1), { expirationTtl: LOGIN_WINDOW_S });
    return json({ error: 'invalid password' }, 401, cors);
  }

  const token = await signSession(env.SESSION_SIGNING_KEY, { ttlMs: SESSION_TTL_MS });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
      ...cors,
    },
  });
}

async function handleListUploads(env, cors) {
  const [kiaRaw, mohamadRaw] = await Promise.all([
    env.UPLOADS_KV.get('uploads:kia'),
    env.UPLOADS_KV.get('uploads:mohamad'),
  ]);
  return json(
    {
      kia: kiaRaw ? JSON.parse(kiaRaw) : [],
      mohamad: mohamadRaw ? JSON.parse(mohamadRaw) : [],
    },
    200,
    cors
  );
}

const VALID_USERS = ['kia', 'mohamad'];

function isoMonth(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function handleCreateUpload(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400, cors);
  }

  const user = body?.user;
  const youtubeUrl = body?.youtube_url;
  const note = (body?.note ?? '').toString().slice(0, 200);

  if (!VALID_USERS.includes(user)) {
    return json({ error: 'invalid user' }, 400, cors);
  }
  const videoId = parseVideoId(youtubeUrl);
  if (!videoId) {
    return json({ error: 'invalid youtube url' }, 400, cors);
  }

  const key = `uploads:${user}`;
  const existingRaw = await env.UPLOADS_KV.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : [];
  if (existing.some((u) => u.video_id === videoId)) {
    return json({ error: 'duplicate' }, 409, cors);
  }

  const oembed = env._oembedMock
    ? await env._oembedMock(youtubeUrl)
    : await fetchOembed(youtubeUrl);

  const quality = env._scoreMock
    ? await env._scoreMock({ title: oembed.title, note })
    : await scoreVideo(
        { title: oembed.title, note },
        { apiKey: env.ANTHROPIC_API_KEY }
      );

  const now = new Date();
  const record = {
    id: crypto.randomUUID(),
    user,
    youtube_url: youtubeUrl,
    video_id: videoId,
    title: oembed.title,
    thumbnail: oembed.thumbnail,
    author: oembed.author,
    note,
    uploaded_at: now.toISOString(),
    published_week: isoWeek(now),
    published_month: isoMonth(now),
    upload_score: 1,
    quality_score: quality,
  };

  existing.push(record);
  await env.UPLOADS_KV.put(key, JSON.stringify(existing));
  return json(record, 201, cors);
}

async function handleDeleteUpload(id, user, env, cors) {
  if (!VALID_USERS.includes(user)) {
    return json({ error: 'invalid user' }, 400, cors);
  }
  const key = `uploads:${user}`;
  const existingRaw = await env.UPLOADS_KV.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : [];
  const next = existing.filter((u) => u.id !== id);
  if (next.length === existing.length) {
    return json({ error: 'not found' }, 404, cors);
  }
  await env.UPLOADS_KV.put(key, JSON.stringify(next));
  return json({ ok: true }, 200, cors);
}

async function handleRescore(id, user, env, cors) {
  if (!VALID_USERS.includes(user)) {
    return json({ error: 'invalid user' }, 400, cors);
  }
  const key = `uploads:${user}`;
  const existingRaw = await env.UPLOADS_KV.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : [];
  const idx = existing.findIndex((u) => u.id === id);
  if (idx === -1) {
    return json({ error: 'not found' }, 404, cors);
  }
  const target = existing[idx];
  const quality = env._scoreMock
    ? await env._scoreMock({ title: target.title, note: target.note })
    : await scoreVideo(
        { title: target.title, note: target.note },
        { apiKey: env.ANTHROPIC_API_KEY }
      );
  existing[idx] = { ...target, quality_score: quality };
  await env.UPLOADS_KV.put(key, JSON.stringify(existing));
  return json(existing[idx], 200, cors);
}

export async function requireAuth(request, env) {
  const cookie = parseCookie(request.headers.get('Cookie'), 'session');
  const result = await verifySession(env.SESSION_SIGNING_KEY, cookie);
  return result.valid;
}

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
