import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../worker.js';
import { hashPassword } from '../lib/auth.js';

function makeEnv(overrides = {}) {
  const store = new Map();
  return {
    UPLOADS_KV: {
      get: async (k) => store.get(k) ?? null,
      put: async (k, v, opts) => { store.set(k, v); },
      delete: async (k) => { store.delete(k); },
    },
    SHARED_PASSWORD_HASH: '',
    SESSION_SIGNING_KEY: 'test-signing-key-32-bytes-long!!',
    ANTHROPIC_API_KEY: 'sk-test',
    ALLOWED_ORIGIN: 'https://example.test',
    _store: store,
    ...overrides,
  };
}

function makeRequest(path, init = {}) {
  return new Request(`https://worker.test${path}`, init);
}

describe('POST /api/login', () => {
  let env;
  beforeEach(async () => {
    env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('correct-horse');
  });

  it('returns 200 and sets cookie on correct password', async () => {
    const req = makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/^session=.+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=\d+/);
  });

  it('returns 401 on wrong password', async () => {
    const req = makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing password', async () => {
    const req = makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('rate-limits after 5 failed attempts from same IP', async () => {
    const ip = '203.0.113.5';
    for (let i = 0; i < 5; i++) {
      const req = makeRequest('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify({ password: 'wrong' }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(401);
    }
    const blocked = await worker.fetch(makeRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ password: 'correct-horse' }),
    }), env);
    expect(blocked.status).toBe(429);
  });
});

async function loggedInRequest(env, path, init = {}) {
  const { signSession } = await import('../lib/auth.js');
  const token = await signSession(env.SESSION_SIGNING_KEY, { ttlMs: 60_000 });
  return makeRequest(path, {
    ...init,
    headers: { ...(init.headers || {}), Cookie: `session=${token}` },
  });
}

describe('GET /api/uploads', () => {
  it('requires auth', async () => {
    const env = makeEnv();
    const res = await worker.fetch(makeRequest('/api/uploads'), env);
    expect(res.status).toBe(401);
  });

  it('returns empty arrays when no uploads yet', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    const res = await worker.fetch(await loggedInRequest(env, '/api/uploads'), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kia: [], mohamad: [] });
  });

  it('returns stored uploads', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._store.set('uploads:kia', JSON.stringify([{ id: '1', title: 'A' }]));
    env._store.set('uploads:mohamad', JSON.stringify([{ id: '2', title: 'B' }]));
    const res = await worker.fetch(await loggedInRequest(env, '/api/uploads'), env);
    expect(await res.json()).toEqual({
      kia: [{ id: '1', title: 'A' }],
      mohamad: [{ id: '2', title: 'B' }],
    });
  });
});
