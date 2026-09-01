import { describe, it, expect } from 'vitest';
import { INTERNAL_ITEM_IDS, isPublicItem, itemIcon, itemMeta } from './itemCatalog';

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

describe('itemIcon — creator catalog icon join', () => {
  const ENDURING_SPIRIT = 558396679; //in the catalog with real CDN art; null shop_image_webp on the wire

  it('a wire icon always wins', () => {
    expect(itemIcon(ENDURING_SPIRIT, 'https://cdn.example/x.webp')).toBe('https://cdn.example/x.webp');
  });

  it('fills a null wire icon from the catalog by id', () => {
    const meta = itemMeta(ENDURING_SPIRIT);
    expect(meta?.icon).toBeTruthy();
    expect(itemIcon(ENDURING_SPIRIT, null)).toBe(meta!.icon);
  });

  it('stays null for entries the catalog is also missing (letter-tile fallback)', () => {
    expect(itemIcon(1248737459, null)).toBeNull(); //Ammo Scavenger — disabled upstream, excluded from the catalog
    expect(itemIcon(null, null)).toBeNull();
    expect(itemIcon(undefined, undefined)).toBeNull();
  });
});
