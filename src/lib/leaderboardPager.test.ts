import { describe, expect, it } from 'vitest';
import {
  lastPage,
  LEADERBOARD_PAGE_SIZE,
  offsetFromPage,
  pageFromSearch,
  pagerWindow,
} from './leaderboardPager';

describe('pageFromSearch', () => {
  it('returns 1 for missing param', () => {
    expect(pageFromSearch('')).toBe(1);
    expect(pageFromSearch('?mode=brawl')).toBe(1);
  });
  it('returns 1 for invalid values', () => {
    expect(pageFromSearch('?page=foo')).toBe(1);
    expect(pageFromSearch('?page=0')).toBe(1);
    expect(pageFromSearch('?page=-5')).toBe(1);
    expect(pageFromSearch('?page=1.5')).toBe(1);
  });
  it('parses valid page numbers', () => {
    expect(pageFromSearch('?page=1')).toBe(1);
    expect(pageFromSearch('?page=7')).toBe(7);
    expect(pageFromSearch('?page=2000')).toBe(2000);
  });
});

describe('offsetFromPage', () => {
  it('maps page 1 to offset 0', () => {
    expect(offsetFromPage(1)).toBe(0);
  });
  it('maps page 2 to one page-size', () => {
    expect(offsetFromPage(2)).toBe(LEADERBOARD_PAGE_SIZE);
  });
  it('maps page N correctly', () => {
    expect(offsetFromPage(5)).toBe(4 * LEADERBOARD_PAGE_SIZE);
  });
});

describe('lastPage', () => {
  it('returns null when total is null', () => {
    expect(lastPage(null)).toBeNull();
  });
  it('returns at least 1 for any non-negative total', () => {
    expect(lastPage(0)).toBe(1);
    expect(lastPage(1)).toBe(1);
  });
  it('computes last page from total', () => {
    expect(lastPage(50)).toBe(1);
    expect(lastPage(51)).toBe(2);
    expect(lastPage(100)).toBe(2);
    expect(lastPage(500)).toBe(10);
  });
  it('clamps at MAX_OFFSET / PAGE_SIZE', () => {
    const cap = Math.ceil(100_000 / LEADERBOARD_PAGE_SIZE);
    expect(lastPage(100_001)).toBe(cap);
    expect(lastPage(999_999)).toBe(cap);
  });
});

describe('pagerWindow', () => {
  it('returns all pages when last is 5 or fewer', () => {
    expect(pagerWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pagerWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('centres the window when far from both edges', () => {
    expect(pagerWindow(10, 100)).toEqual([8, 9, 10, 11, 12]);
  });
  it('clamps at page 1 near the start', () => {
    expect(pagerWindow(1, 100)).toEqual([1, 2, 3, 4, 5]);
    expect(pagerWindow(2, 100)).toEqual([1, 2, 3, 4, 5]);
  });
  it('clamps at last near the end', () => {
    expect(pagerWindow(100, 100)).toEqual([96, 97, 98, 99, 100]);
    expect(pagerWindow(99, 100)).toEqual([96, 97, 98, 99, 100]);
  });
  it('total=null fallback: Prev/Next only when total is null', () => {
    expect(lastPage(null)).toBeNull();
  });
});
