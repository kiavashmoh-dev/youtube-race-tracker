import { describe, it, expect } from 'vitest';
import { parseVideoId } from '../lib/parseUrl.js';

describe('parseVideoId (worker)', () => {
  it('parses watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123XYZ_-')).toBe('abc123XYZ_-');
  });
  it('parses youtu.be URL', () => {
    expect(parseVideoId('https://youtu.be/abc123XYZ_-')).toBe('abc123XYZ_-');
  });
  it('parses shorts URL', () => {
    expect(parseVideoId('https://www.youtube.com/shorts/abc123XYZ_-')).toBe('abc123XYZ_-');
  });
  it('returns null for non-YouTube URL', () => {
    expect(parseVideoId('https://example.com/watch?v=abc123XYZ_-')).toBeNull();
  });
  it('returns null for garbage', () => {
    expect(parseVideoId('lol')).toBeNull();
  });
});
