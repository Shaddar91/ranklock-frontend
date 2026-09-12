import { describe, it, expect } from 'vitest';
import {
  categoryOf,
  CATEGORIES,
  FLEX_SLOTS,
  indexCatalog,
  INVENTORY_SLOTS,
  layoutBuild,
  normalizeCatalog,
  TOTAL_SLOTS,
  type CatalogItem,
} from './buildModel';

function item(id: number, slot: string | null = 'weapon'): CatalogItem {
  return { item_id: id, item_name: `Item ${id}`, item_slot_type: slot, item_tier: 1, cost: 800, icon: null, modifiers: [] };
}

const CATALOG = indexCatalog(Array.from({ length: 20 }, (_, i) => item(i + 1)));

describe('the board is 9 inventory slots + 3 flex slots', () => {
  it('pins the slot counts the 2025-11-21 client ships', () => {
    expect(INVENTORY_SLOTS).toBe(9);
    expect(FLEX_SLOTS).toBe(3);
    expect(TOTAL_SLOTS).toBe(12);
  });

  it('fills the 9 inventory slots first, then the 3 flex slots', () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const { inventory, flex, extra } = layoutBuild(ids, CATALOG);
    expect(inventory).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(flex).toEqual([10, 11, 12]);
    expect(extra).toEqual([]);
  });

  it('takes any item in any slot — category never decides placement', () => {
    const mixed = indexCatalog([item(1, 'spirit'), item(2, null), item(3, 'vitality')]);
    const { inventory, flex } = layoutBuild([1, 2, 3], mixed);
    expect(inventory).toEqual([1, 2, 3]);
    expect(flex).toEqual([]);
  });

  it('surfaces a 13th item instead of dropping it', () => {
    const { extra } = layoutBuild(Array.from({ length: 13 }, (_, i) => i + 1), CATALOG);
    expect(extra).toEqual([13]);
  });

  it('sends ids the patch catalog does not carry off the board', () => {
    const { inventory, extra } = layoutBuild([1, 999, 2], CATALOG);
    expect(inventory).toEqual([1, 2]);
    expect(extra).toEqual([999]);
  });
});

describe('categoryOf — flex is a slot, never a shop category', () => {
  it('names the three shop categories and nothing else', () => {
    expect(CATEGORIES).toEqual(['weapon', 'vitality', 'spirit']);
    expect(categoryOf('weapon')).toBe('weapon');
    expect(categoryOf('vitality')).toBe('vitality');
    expect(categoryOf('spirit')).toBe('spirit');
  });
  it('returns null for a slot the catalog does not categorise', () => {
    expect(categoryOf(null)).toBeNull();
    expect(categoryOf(undefined)).toBeNull();
    expect(categoryOf('flex')).toBeNull();
  });
});

describe('normalizeCatalog', () => {
  it('drops rows with no id and keeps typed modifier rows', () => {
    const rows = normalizeCatalog([
      { item_id: null, item_name: 'x', item_slot_type: 'weapon', item_tier: 1, shop_image_webp: null, cost: 800, modifiers: [] },
      {
        item_id: 7,
        item_name: 'Basic Magazine',
        item_slot_type: 'weapon',
        item_tier: 1,
        shop_image_webp: null,
        cost: 800,
        modifiers: [{ property_type: 'P', value: 8, is_percent: true, label: 'Ammo' }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.item_id).toBe(7);
    expect(rows[0]?.modifiers).toHaveLength(1);
  });
});
