import { describe, it, expect, vi } from 'vitest';
import { fetchOembed } from '../lib/oembed.js';

describe('fetchOembed', () => {
  it('returns title, thumbnail, author on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Test Video',
        thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        author_name: 'Kia',
      }),
    });
    const result = await fetchOembed('https://youtu.be/abc12345678', { fetch: fetchMock });
    expect(result).toEqual({
      title: 'Test Video',
      thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      author: 'Kia',
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://www.youtube.com/oembed');
    expect(url).toContain('url=' + encodeURIComponent('https://youtu.be/abc12345678'));
  });

  it('returns nulls on non-2xx (private/deleted video)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const result = await fetchOembed('https://youtu.be/abc12345678', { fetch: fetchMock });
    expect(result).toEqual({ title: null, thumbnail: null, author: null });
  });

  it('returns nulls when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await fetchOembed('https://youtu.be/abc12345678', { fetch: fetchMock });
    expect(result).toEqual({ title: null, thumbnail: null, author: null });
  });

  it('returns nulls when JSON is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('bad'); } });
    const result = await fetchOembed('https://youtu.be/abc12345678', { fetch: fetchMock });
    expect(result).toEqual({ title: null, thumbnail: null, author: null });
  });
});
