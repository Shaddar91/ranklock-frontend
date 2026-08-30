import { describe, expect, it } from 'vitest';
import { itemBracketParam, itemHeroParam } from './brackets';

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
