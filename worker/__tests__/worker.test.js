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
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(20);
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
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
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

describe('POST /api/uploads', () => {
  it('rejects bad URL', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    const req = await loggedInRequest(env, '/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'kia', youtube_url: 'not a url', note: '' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('rejects unknown user', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    const req = await loggedInRequest(env, '/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'somebody',
        youtube_url: 'https://youtu.be/abc12345678',
        note: '',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('creates an upload with score from injected dependencies', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._oembedMock = async () => ({ title: 'Hi', thumbnail: 'thumb', author: 'kia' });
    env._scoreMock = async () => 3;
    const req = await loggedInRequest(env, '/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'kia',
        youtube_url: 'https://youtu.be/abc12345678',
        note: 'great take',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(201);
    const record = await res.json();
    expect(record.user).toBe('kia');
    expect(record.video_id).toBe('abc12345678');
    expect(record.title).toBe('Hi');
    expect(record.quality_score).toBe(3);
    expect(record.upload_score).toBe(1);
    expect(record.note).toBe('great take');
    expect(record.published_month).toMatch(/^\d{4}-\d{2}$/);
    expect(record.published_week).toMatch(/^\d{4}-W\d{2}$/);

    const stored = JSON.parse(env._store.get('uploads:kia'));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(record.id);
  });

  it('rejects duplicate video_id', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._oembedMock = async () => ({ title: 'X', thumbnail: '', author: '' });
    env._scoreMock = async () => 2;
    env._store.set(
      'uploads:kia',
      JSON.stringify([{ id: 'existing', video_id: 'abc12345678' }])
    );
    const req = await loggedInRequest(env, '/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'kia',
        youtube_url: 'https://youtu.be/abc12345678',
        note: '',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(409);
  });

  it('saves record with quality_score=null if score fails', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._oembedMock = async () => ({ title: 'X', thumbnail: '', author: '' });
    env._scoreMock = async () => null;
    const req = await loggedInRequest(env, '/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'mohamad',
        youtube_url: 'https://youtu.be/abc12345678',
        note: '',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(201);
    const record = await res.json();
    expect(record.quality_score).toBeNull();
    expect(record.user).toBe('mohamad');
  });
});

describe('DELETE /api/uploads/:id', () => {
  it('removes an upload', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._store.set(
      'uploads:kia',
      JSON.stringify([
        { id: 'a', video_id: '1' },
        { id: 'b', video_id: '2' },
      ])
    );
    const req = await loggedInRequest(env, '/api/uploads/a?user=kia', { method: 'DELETE' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const remaining = JSON.parse(env._store.get('uploads:kia'));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('b');
  });

  it('404 when id not found', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._store.set('uploads:kia', JSON.stringify([]));
    const req = await loggedInRequest(env, '/api/uploads/nope?user=kia', { method: 'DELETE' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/uploads/:id/rescore', () => {
  it('updates quality_score on existing upload', async () => {
    const env = makeEnv();
    env.SHARED_PASSWORD_HASH = await hashPassword('x');
    env._scoreMock = async () => 2;
    env._store.set(
      'uploads:kia',
      JSON.stringify([
        { id: 'a', video_id: '1', title: 'T', note: 'N', quality_score: null },
      ])
    );
    const req = await loggedInRequest(env, '/api/uploads/a/rescore?user=kia', { method: 'POST' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const stored = JSON.parse(env._store.get('uploads:kia'));
    expect(stored[0].quality_score).toBe(2);
  });
});
