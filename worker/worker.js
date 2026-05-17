import { hashPassword, signSession, verifySession, parseCookie } from './lib/auth.js';

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
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
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
