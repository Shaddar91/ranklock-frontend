import { describe, it, expect } from 'vitest';
import { isPublicItem, INTERNAL_ITEM_IDS } from './itemCatalog';

describe('isPublicItem — internal-item catalog filter', () => {
  const INTERNAL = [4284855775, 3449296332, 2861048274]; //upgrade_clip_size_2 / _3 / _fixed_t3

  it('flags the three iconless internal upgrade entries as non-public', () => {
    for (const id of INTERNAL) {
      expect(INTERNAL_ITEM_IDS.has(id)).toBe(true);
      expect(isPublicItem(id)).toBe(false);
    }
  });

  it('keeps real shoppable items', () => {
    expect(isPublicItem(968099481)).toBe(true); //Extra Spirit (live /items)
    expect(isPublicItem(3535785353)).toBe(true); //upgrade_clip_size_fixed — shipped sibling, has icon
  });

  it('treats a null/absent id as public (never filters an unknown row)', () => {
    expect(isPublicItem(null)).toBe(true);
    expect(isPublicItem(undefined)).toBe(true);
  });
});
