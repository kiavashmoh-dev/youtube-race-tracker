import { describe, it, expect } from 'vitest';
import { isoWeek, isoMonth } from '../utils/date';

describe('isoMonth', () => {
  it('formats a date as YYYY-MM', () => {
    expect(isoMonth(new Date('2026-05-17T14:30:00Z'))).toBe('2026-05');
  });

  it('pads single-digit months', () => {
    expect(isoMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
});

describe('isoWeek', () => {
  it('returns YYYY-Www for mid-year date', () => {
    expect(isoWeek(new Date('2026-05-17T14:30:00Z'))).toBe('2026-W20');
  });

  it('returns last-year week number near January 1st', () => {
    // Jan 1, 2027 is a Friday — falls in ISO week 53 of 2026
    expect(isoWeek(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });

  it('returns first ISO week correctly', () => {
    // Jan 5, 2026 is a Monday — ISO week 2 of 2026
    expect(isoWeek(new Date('2026-01-05T12:00:00Z'))).toBe('2026-W02');
  });
});
