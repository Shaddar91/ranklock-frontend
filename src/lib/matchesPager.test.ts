import { describe, expect, it } from 'vitest';
import {
  lastPage,
  MATCHES_LAST_PAGE,
  MATCHES_PAGE_SIZE,
  offsetFromPage,
  pageFromSearch,
  pagerWindow,
  recentMatchesParams,
} from './matchesPager';

describe('pageFromSearch', () => {
  it('defaults to 1 when absent', () => {
    expect(pageFromSearch('')).toBe(1);
    expect(pageFromSearch('?ranked=1')).toBe(1);
  });
  it('parses a positive integer', () => {
    expect(pageFromSearch('?page=3')).toBe(3);
    expect(pageFromSearch('?page=2001')).toBe(2001);
  });
  it('rejects junk, zero, negatives, floats', () => {
    for (const raw of ['abc', '0', '-2', '1.5', '']) {
      expect(pageFromSearch(`?page=${raw}`)).toBe(1);
    }
  });
});

describe('offsetFromPage', () => {
  it('page 1 is offset 0', () => {
    expect(offsetFromPage(1)).toBe(0);
  });
  it('page N is (N-1)*size', () => {
    expect(offsetFromPage(2)).toBe(MATCHES_PAGE_SIZE);
    expect(offsetFromPage(11)).toBe(10 * MATCHES_PAGE_SIZE);
  });
});

describe('lastPage', () => {
  it('unknown total stays unknown', () => {
    expect(lastPage(null)).toBeNull();
  });
  it('small totals round up, floor 1', () => {
    expect(lastPage(0)).toBe(1);
    expect(lastPage(1)).toBe(1);
    expect(lastPage(MATCHES_PAGE_SIZE)).toBe(1);
    expect(lastPage(MATCHES_PAGE_SIZE + 1)).toBe(2);
  });
  it('caps at the offset ceiling', () => {
    expect(lastPage(4_248_145)).toBe(MATCHES_LAST_PAGE);
    expect(lastPage(100_000 + MATCHES_PAGE_SIZE)).toBe(MATCHES_LAST_PAGE);
  });
});

describe('pagerWindow', () => {
  it('short ranges list every page', () => {
    expect(pagerWindow(1, 1)).toEqual([1]);
    expect(pagerWindow(2, 3)).toEqual([1, 2, 3]);
  });
  it('centers a 5-wide window, clamped at both ends', () => {
    expect(pagerWindow(1, 9)).toEqual([1, 2, 3, 4, 5]);
    expect(pagerWindow(5, 9)).toEqual([3, 4, 5, 6, 7]);
    expect(pagerWindow(9, 9)).toEqual([5, 6, 7, 8, 9]);
  });
});

describe('recentMatchesParams', () => {
  it('default filters, page 1 — limit + game_mode only (no offset key, seed parity)', () => {
    expect(recentMatchesParams(1, 'normal', 'any')).toEqual({
      limit: MATCHES_PAGE_SIZE,
      game_mode: 'Normal',
    });
  });
  it('all-modes ranked page 2 — offset + match_mode, no game_mode', () => {
    expect(recentMatchesParams(2, 'all', 'ranked')).toEqual({
      limit: MATCHES_PAGE_SIZE,
      offset: MATCHES_PAGE_SIZE,
      match_mode: 'Ranked',
    });
  });
  it('brawl unranked page 3 — every filter mapped', () => {
    expect(recentMatchesParams(3, 'brawl', 'unranked')).toEqual({
      limit: MATCHES_PAGE_SIZE,
      offset: 2 * MATCHES_PAGE_SIZE,
      game_mode: 'StreetBrawl',
      match_mode: 'Unranked',
    });
  });
});
