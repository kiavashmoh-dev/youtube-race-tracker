import { describe, it, expect } from 'vitest';
import { parseVideoId } from '../utils/youtube';

describe('parseVideoId', () => {
  it('extracts id from standard watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123XYZ_-')).toBe('abc123XYZ_-');
  });

  it('extracts id from short youtu.be URL', () => {
    expect(parseVideoId('https://youtu.be/abc123XYZ_-')).toBe('abc123XYZ_-');
  });

  it('extracts id from shorts URL', () => {
    expect(parseVideoId('https://www.youtube.com/shorts/abc123XYZ_-')).toBe('abc123XYZ_-');
  });

  it('extracts id when extra query params are present', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123XYZ_-&t=42s&feature=share')).toBe('abc123XYZ_-');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(parseVideoId('https://vimeo.com/12345')).toBeNull();
  });

  it('returns null for malformed strings', () => {
    expect(parseVideoId('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseVideoId('')).toBeNull();
  });
});
