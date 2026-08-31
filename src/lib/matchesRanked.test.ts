import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANKED_FILTER,
  RANKED_FILTER_PARAM,
  filterRowsByRanked,
  rankedFilterFromParam,
  rankedFilterToParam,
} from './matchesRanked';

describe('rankedFilterFromParam — ?ranked= URL value to filter', () => {
  it('absent (null/undefined) → Any default', () => {
    expect(rankedFilterFromParam(null)).toBe('any');
    expect(rankedFilterFromParam(undefined)).toBe('any');
  });
  it('"1" / "true" / "ranked" (case-insensitive, trimmed) → ranked', () => {
    expect(rankedFilterFromParam('1')).toBe('ranked');
    expect(rankedFilterFromParam('true')).toBe('ranked');
    expect(rankedFilterFromParam('RANKED')).toBe('ranked');
    expect(rankedFilterFromParam(' 1 ')).toBe('ranked');
  });
  it('"0" / "false" / "unranked" → unranked', () => {
    expect(rankedFilterFromParam('0')).toBe('unranked');
    expect(rankedFilterFromParam('false')).toBe('unranked');
    expect(rankedFilterFromParam('UNRANKED')).toBe('unranked');
  });
  it('empty / garbage → Any (hostile input never selects an unknown filter)', () => {
    expect(rankedFilterFromParam('')).toBe('any');
    expect(rankedFilterFromParam('casual')).toBe('any');
  });
});

describe('rankedFilterToParam — filter to canonical URL slug (Any omitted)', () => {
  it('any → null (kept out of the URL)', () => expect(rankedFilterToParam('any')).toBeNull());
  it('ranked → "1"', () => expect(rankedFilterToParam('ranked')).toBe('1'));
  it('unranked → "0"', () => expect(rankedFilterToParam('unranked')).toBe('0'));
});

describe('round-trip — param → filter → param is stable', () => {
  it('ranked round-trips 1 → ranked → 1', () => expect(rankedFilterToParam(rankedFilterFromParam('1'))).toBe('1'));
  it('unranked round-trips 0 → unranked → 0', () => expect(rankedFilterToParam(rankedFilterFromParam('0'))).toBe('0'));
  it('default round-trips absent → any → no-param', () => expect(rankedFilterToParam(rankedFilterFromParam(null))).toBeNull());
});

describe('shared ?ranked= param + default', () => {
  it('reuses the "ranked" param name (one param across both controls)', () => expect(RANKED_FILTER_PARAM).toBe('ranked'));
  it('the default filter is Any', () => expect(DEFAULT_RANKED_FILTER).toBe('any'));
  //'0'/'1' are the explicit values the 2-state selector's parser also honours (0→Unranked, 1→Ranked),
  //so an explicit choice agrees across both controls; only the empty default differs.
  it('explicit slugs match the 2-state selector encoding', () => {
    expect(rankedFilterToParam('ranked')).toBe('1');
    expect(rankedFilterToParam('unranked')).toBe('0');
  });
});

describe('filterRowsByRanked — client-side match_mode row filter', () => {
  const rows = [
    { match_id: 1, match_mode: 'Ranked' },
    { match_id: 2, match_mode: 'Unranked' },
    { match_id: 3, match_mode: null },
  ];
  it('any → all rows unchanged', () => expect(filterRowsByRanked(rows, 'any')).toHaveLength(3));
  it('ranked → only Ranked rows', () =>
    expect(filterRowsByRanked(rows, 'ranked').map((r) => r.match_id)).toEqual([1]));
  it('unranked → every non-Ranked row (Unranked + null)', () =>
    expect(filterRowsByRanked(rows, 'unranked').map((r) => r.match_id)).toEqual([2, 3]));
  it('ranked ∪ unranked = any (partition)', () => {
    const r = filterRowsByRanked(rows, 'ranked').length;
    const u = filterRowsByRanked(rows, 'unranked').length;
    expect(r + u).toBe(filterRowsByRanked(rows, 'any').length);
  });
});
