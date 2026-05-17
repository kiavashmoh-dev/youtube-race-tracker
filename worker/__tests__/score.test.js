import { describe, it, expect, vi } from 'vitest';
import { scoreVideo, buildPrompt, parseScore } from '../lib/score.js';

describe('buildPrompt', () => {
  it('includes title and note', () => {
    const p = buildPrompt({ title: 'My Video', note: 'first time on camera' });
    expect(p).toContain('My Video');
    expect(p).toContain('first time on camera');
  });

  it('uses "none" when note missing', () => {
    const p = buildPrompt({ title: 'Hi', note: '' });
    expect(p).toContain('"none"');
  });

  it('uses "(no title)" when title missing', () => {
    const p = buildPrompt({ title: null, note: 'oembed failed' });
    expect(p).toContain('(no title)');
  });
});

describe('parseScore', () => {
  it('extracts a valid 1/2/3', () => {
    expect(parseScore('3')).toBe(3);
    expect(parseScore('2\n')).toBe(2);
    expect(parseScore('The answer is 1.')).toBe(1);
  });

  it('returns null for invalid', () => {
    expect(parseScore('zero')).toBeNull();
    expect(parseScore('4')).toBeNull();
    expect(parseScore('0')).toBeNull();
    expect(parseScore('')).toBeNull();
  });
});

describe('scoreVideo', () => {
  it('calls Anthropic with the right shape and returns score', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '3' }] }),
    });
    const score = await scoreVideo(
      { title: 'X', note: '' },
      { apiKey: 'sk-test', fetch: fetchMock }
    );
    expect(score).toBe(3);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.max_tokens).toBe(5);
    expect(init.headers['x-api-key']).toBe('sk-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('returns null on non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const score = await scoreVideo(
      { title: 'X', note: '' },
      { apiKey: 'sk-test', fetch: fetchMock }
    );
    expect(score).toBeNull();
  });

  it('returns null when content is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'banana' }] }),
    });
    const score = await scoreVideo({ title: 'X', note: '' }, { apiKey: 'k', fetch: fetchMock });
    expect(score).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const score = await scoreVideo({ title: 'X', note: '' }, { apiKey: 'k', fetch: fetchMock });
    expect(score).toBeNull();
  });
});
