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
    //upgrade_clip_size_fixed — a codename phantom on the wire, but a bare id carries no
    //name/image to judge, so only the denylist applies.
    expect(isPublicItem(3535785353)).toBe(true);
  });

  it('treats a null/absent id as public (never filters an unknown row)', () => {
    expect(isPublicItem(null)).toBe(true);
    expect(isPublicItem(undefined)).toBe(true);
  });

  it('drops a phantom row: `upgrade_` codename, and a named row no source can draw a tile for', () => {
    const phantom = { item_id: 1544322593, item_name: 'upgrade_stabilizer', shop_image_webp: null };
    expect(isPublicItem(phantom)).toBe(false);
    //Endless Magazine — named upstream but carries only ability art; not in the catalog or glyphs.
    expect(isPublicItem({ item_id: 3346798998, item_name: 'Endless Magazine', shop_image_webp: null })).toBe(false);
  });

  it('keeps a live row: wire shop tile, and a glyph-only shop item with no wire image', () => {
    const live = {
      item_id: 968099481,
      item_name: 'Extra Spirit',
      shop_image_webp: 'https://assets-bucket.deadlock-api.com/assets-api-res/images/items/spirit/extra_spirit.webp',
    };
    expect(isPublicItem(live)).toBe(true);
    //Toughness — in the shop, but upstream ships no shop tile; the glyph map draws it.
    expect(isPublicItem({ item_id: 2858617477, item_name: 'Toughness', shop_image_webp: null })).toBe(true);
    //The denylist wins even over a row that otherwise looks shoppable.
    expect(isPublicItem({ ...live, item_id: 4284855775 })).toBe(false);
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

  it('falls back to the glyph map for entries the catalog skips (no shop tile)', () => {
    expect(itemIcon(1248737459, null)).toMatch(/upgrades\/mods_weapon\/ammo_scavenger\.webp$/); //Ammo Scavenger
  });

  it('treats a malformed wire icon as missing and falls through', () => {
    const junk = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/panorama:""';
    expect(itemIcon(2858617477, junk)).toMatch(/upgrades\/mods_armor\/health\.webp$/); //Toughness
    expect(itemIcon(3346798998, junk)).toBeNull(); //Endless Magazine — only ability art upstream
  });

  it('stays null when nothing is known (letter-tile fallback)', () => {
    expect(itemIcon(null, null)).toBeNull();
    expect(itemIcon(undefined, undefined)).toBeNull();
  });
});
