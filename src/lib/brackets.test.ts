import { describe, expect, it } from 'vitest';
import { ITEM_BUCKETS, itemBracketParam, itemHeroParam, rankBucket, tierSpanLabel } from './brackets';

describe('ITEM_BUCKETS', () => {
  it('names each bracket by the ladder tiers it spans', () => {
    expect(ITEM_BUCKETS.map((b) => b.label)).toEqual([
      'All ranks',
      'Initiate to Acolyte',
      'Sentinel to Mystic',
      'Ritualist to Emissary',
      'Oracle to Phantom',
      'Ascendant to Eternus',
    ]);
  });
  it('carries no retired rank name', () => {
    expect(ITEM_BUCKETS.map((b) => b.label).join(' ')).not.toMatch(/Archon|Alchemist|Arcanist/);
  });
  it('keeps the integer keys the API takes, 0 = all', () => {
    expect(ITEM_BUCKETS.map((b) => b.key)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('tierSpanLabel and rankBucket', () => {
  it('collapses a single tier and names the empty span All ranks', () => {
    expect(tierSpanLabel([8])).toBe('Oracle');
    expect(tierSpanLabel([])).toBe('All ranks');
    expect(tierSpanLabel([9, 8])).toBe('Oracle to Phantom');
  });
  it('derives the short label from the lowest tier unless one is given', () => {
    expect(rankBucket('high', [8, 9]).short).toBe('Oracle+');
    expect(rankBucket('top', [10, 11], 'Top').short).toBe('Top');
    expect(rankBucket('all', []).short).toBe('All');
  });
});

describe('itemBracketParam', () => {
  it('forwards numeric bucket keys and maps non-numeric keys to 0 (all ranks)', () => {
    expect(itemBracketParam(0)).toBe(0);
    expect(itemBracketParam(5)).toBe(5);
    expect(itemBracketParam('all' as never)).toBe(0);
  });
});

describe('itemHeroParam', () => {
  it('omits the hero filter for "All heroes" (0) and anything that is not a positive integer', () => {
    expect(itemHeroParam(0)).toBeUndefined();
    expect(itemHeroParam(-1)).toBeUndefined();
    expect(itemHeroParam(NaN)).toBeUndefined();
    expect(itemHeroParam(1.5)).toBeUndefined();
  });
  it('forwards a real hero id', () => {
    expect(itemHeroParam(7)).toBe(7);
  });
});
