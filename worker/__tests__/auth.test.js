import { describe, it, expect } from 'vitest';
import { hashPassword, signSession, verifySession, parseCookie } from '../lib/auth.js';

const KEY = 'test-signing-key-32-bytes-long!!';

describe('hashPassword', () => {
  it('returns hex SHA-256', async () => {
    const h = await hashPassword('hunter2');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).toBe(await hashPassword('hunter2'));
  });

  it('differs for different inputs', async () => {
    expect(await hashPassword('a')).not.toBe(await hashPassword('b'));
  });
});

describe('session cookie', () => {
  it('signs and verifies a fresh token', async () => {
    const token = await signSession(KEY, { ttlMs: 60_000 });
    const result = await verifySession(KEY, token);
    expect(result.valid).toBe(true);
  });

  it('rejects tampered tokens', async () => {
    const token = await signSession(KEY, { ttlMs: 60_000 });
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    const result = await verifySession(KEY, tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects expired tokens', async () => {
    const token = await signSession(KEY, { ttlMs: -1 });
    const result = await verifySession(KEY, token);
    expect(result.valid).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    const result = await verifySession(KEY, 'not-a-token');
    expect(result.valid).toBe(false);
  });
});

describe('parseCookie', () => {
  it('returns null when header missing', () => {
    expect(parseCookie(null, 'session')).toBeNull();
  });

  it('extracts a named cookie', () => {
    expect(parseCookie('a=1; session=xyz; b=2', 'session')).toBe('xyz');
  });

  it('returns null when name absent', () => {
    expect(parseCookie('a=1; b=2', 'session')).toBeNull();
  });
});
