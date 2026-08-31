import { describe, expect, it } from 'vitest';
import {
  afterRankForPage,
  lastPage,
  LEADERBOARD_PAGE_SIZE,
  MAX_OFFSET,
  OFFSET_LAST_PAGE,
  offsetFromPage,
  pageFromSearch,
  pagerWindow,
  usesKeyset,
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
    expect(pageFromSearch('?page=20112')).toBe(20112);
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
  //Clamp removed: the deep ladder is fully reachable (deep pages ride the ?after_rank= keyset path).
  it('no longer clamps at MAX_OFFSET — full ladder depth', () => {
    expect(lastPage(100_001)).toBe(2001);
    expect(lastPage(999_999)).toBe(20_000);
    expect(lastPage(1_005_590)).toBe(20_112);
  });
});

describe('afterRankForPage', () => {
  it('is the offset of the page — rows come back ranked offset+1..offset+size', () => {
    expect(afterRankForPage(1)).toBe(0);
    expect(afterRankForPage(2)).toBe(50);
    expect(afterRankForPage(2001)).toBe(100_000);
    expect(afterRankForPage(20_112)).toBe(1_005_550);
  });
  it('equals offsetFromPage so a keyset page matches the offset page at that depth', () => {
    for (const p of [1, 7, 2000, 2001, 2002, 50_000]) {
      expect(afterRankForPage(p)).toBe(offsetFromPage(p));
    }
  });
});

describe('usesKeyset', () => {
  it('keeps the cheap offset path while offset <= MAX_OFFSET', () => {
    expect(usesKeyset(1)).toBe(false);
    expect(usesKeyset(2000)).toBe(false);
    expect(usesKeyset(2001)).toBe(false);
  });
  it('switches to the keyset path once offset passes MAX_OFFSET', () => {
    expect(usesKeyset(2002)).toBe(true);
    expect(usesKeyset(20_112)).toBe(true);
  });
  it('OFFSET_LAST_PAGE is the deepest offset-servable page', () => {
    expect(OFFSET_LAST_PAGE).toBe(2001);
    expect(offsetFromPage(OFFSET_LAST_PAGE)).toBe(MAX_OFFSET);
    expect(usesKeyset(OFFSET_LAST_PAGE)).toBe(false);
    expect(usesKeyset(OFFSET_LAST_PAGE + 1)).toBe(true);
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
  it('holds the 5-wide window deep in the ladder', () => {
    expect(pagerWindow(20_000, 20_112)).toEqual([19_998, 19_999, 20_000, 20_001, 20_002]);
    expect(pagerWindow(20_112, 20_112)).toEqual([20_108, 20_109, 20_110, 20_111, 20_112]);
  });
});
