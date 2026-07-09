import { describe, it, expect } from 'vitest';
import { pct, fixed, count, kda, metaTier, pickShare, duration, shortDate, readingTime, DASH } from './format';

//Pure display formatters + stat derivations. The whole point of these is that a
//missing/NaN input renders the em-dash (or a safe default) rather than "NaN%"/"null",
//so every test pins both the happy path AND the null/NaN/edge behavior.

describe('pct', () => {
  it('formats a percentage with one decimal by default', () => {
    expect(pct(53.8)).toBe('53.8%');
  });
  it('honors a custom decimal count', () => {
    expect(pct(53.849, 2)).toBe('53.85%');
  });
  it('renders the dash for null / undefined / NaN', () => {
    expect(pct(null)).toBe(DASH);
    expect(pct(undefined)).toBe(DASH);
    expect(pct(NaN)).toBe(DASH);
  });
});

describe('fixed', () => {
  it('formats to two decimals by default', () => {
    expect(fixed(2.714)).toBe('2.71');
  });
  it('renders the dash for missing / NaN', () => {
    expect(fixed(null)).toBe(DASH);
    expect(fixed(NaN)).toBe(DASH);
  });
});

describe('count', () => {
  it('groups thousands and rounds', () => {
    expect(count(1840)).toBe('1,840');
    expect(count(1840.6)).toBe('1,841');
  });
  it('renders the dash for missing / NaN', () => {
    expect(count(null)).toBe(DASH);
    expect(count(NaN)).toBe(DASH);
  });
});

describe('kda', () => {
  it('computes (kills + assists) / deaths', () => {
    expect(kda(5, 2, 10)).toBe(7.5);
  });
  it('floors deaths at 1 so a deathless game does not divide by zero', () => {
    expect(kda(3, 0, 1)).toBe(4);
  });
  it('returns null when any input is missing', () => {
    expect(kda(null, 1, 1)).toBeNull();
    expect(kda(1, undefined, 1)).toBeNull();
    expect(kda(1, 1, null)).toBeNull();
  });
});

describe('metaTier', () => {
  it('grades at each threshold boundary (>= is inclusive)', () => {
    expect(metaTier(52.5)).toBe('S');
    expect(metaTier(51)).toBe('A');
    expect(metaTier(49.5)).toBe('B');
    expect(metaTier(48)).toBe('C');
  });
  it('grades just below each boundary into the next tier down', () => {
    expect(metaTier(52.4)).toBe('A');
    expect(metaTier(50.9)).toBe('B');
    expect(metaTier(49.4)).toBe('C');
    expect(metaTier(47.9)).toBe('D');
  });
  it('grades the extremes', () => {
    expect(metaTier(100)).toBe('S');
    expect(metaTier(0)).toBe('D');
  });
  it('returns null for null / undefined / NaN', () => {
    expect(metaTier(null)).toBeNull();
    expect(metaTier(undefined)).toBeNull();
    expect(metaTier(NaN)).toBeNull();
  });
});

describe('pickShare', () => {
  it('computes the share as a percentage of the total', () => {
    expect(pickShare(50, 200)).toBe(25);
  });
  it('treats a zero pick count as a real 0% (not missing)', () => {
    expect(pickShare(0, 200)).toBe(0);
  });
  it('returns null on divide-by-zero (total <= 0)', () => {
    expect(pickShare(50, 0)).toBeNull();
    expect(pickShare(50, -5)).toBeNull();
  });
  it('returns null when the pick count is missing', () => {
    expect(pickShare(null, 200)).toBeNull();
    expect(pickShare(undefined, 200)).toBeNull();
  });
});

describe('duration', () => {
  it('formats seconds as mm:ss with a zero-padded seconds field', () => {
    expect(duration(1961)).toBe('32:41');
    expect(duration(61)).toBe('1:01');
    expect(duration(59)).toBe('0:59');
    expect(duration(0)).toBe('0:00');
  });
  it('does not roll minutes past 59 (mm is unbounded)', () => {
    expect(duration(3600)).toBe('60:00');
  });
  it('floors fractional seconds', () => {
    expect(duration(90.7)).toBe('1:30');
  });
  it('renders the dash for missing / NaN / negative', () => {
    expect(duration(null)).toBe(DASH);
    expect(duration(undefined)).toBe(DASH);
    expect(duration(NaN)).toBe(DASH);
    expect(duration(-5)).toBe(DASH);
  });
});

describe('shortDate', () => {
  it('formats an ISO timestamp as a UTC-stable "Mon D, YYYY"', () => {
    expect(shortDate('2026-06-19T00:00:00Z')).toBe('Jun 19, 2026');
  });
  it('is timezone-stable (uses UTC, not the runner local zone)', () => {
    //23:30 UTC must NOT roll forward/back a calendar day regardless of TZ.
    expect(shortDate('2026-01-01T23:30:00Z')).toBe('Jan 1, 2026');
  });
  it('returns an empty string for missing / invalid input', () => {
    expect(shortDate(null)).toBe('');
    expect(shortDate(undefined)).toBe('');
    expect(shortDate('')).toBe('');
    expect(shortDate('not-a-date')).toBe('');
  });
});

describe('readingTime', () => {
  it('estimates at ~200 wpm', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    expect(readingTime(words)).toBe('2 min read');
  });
  it('floors at 1 minute for short / empty / missing bodies', () => {
    expect(readingTime('just a few words')).toBe('1 min read');
    expect(readingTime('')).toBe('1 min read');
    expect(readingTime(null)).toBe('1 min read');
  });
});
