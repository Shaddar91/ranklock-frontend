import { describe, expect, it } from 'vitest';
import {
  activePreset,
  ALL_CATEGORIES,
  CATEGORY_TIERS,
  categoryTitle,
  filterByCategory,
  hasTopHero,
  itemIndexRows,
  SORT_PRESETS,
  toggleSlot,
  toggleTier,
} from './itemsIndex';
import type { ItemModifier, ItemStat } from '../types/api';

const catalog = [
  { item_id: 1, item_name: 'Basic Magazine', item_slot_type: 'weapon', item_tier: 1, cost: 800, shop_image_webp: null, modifiers: [] },
  { item_id: 2, item_name: 'Leech', item_slot_type: 'weapon', item_tier: 4, cost: 6400, shop_image_webp: null, modifiers: [] },
  { item_id: 3, item_name: 'Metal Skin', item_slot_type: 'vitality', item_tier: 5, cost: 9999, shop_image_webp: null, modifiers: [] },
] as ItemModifier[];

const stats = [
  { item_id: 1, win_rate: 51, matches: 900, avg_buy_time_s: 240 },
  { item_id: 2, win_rate: 55, matches: 300, avg_buy_time_s: 1500 },
  { item_id: 3, win_rate: 48, matches: 120, avg_buy_time_s: 1900 },
  //No catalog row: the join must keep it, uncategorised.
  { item_id: 9, win_rate: 50, matches: 10, avg_buy_time_s: 600 },
] as ItemStat[];

describe('category selection', () => {
  it('runs tiers I-V, Tier V included', () => {
    expect(CATEGORY_TIERS).toEqual([1, 2, 3, 4, 5]);
  });

  it('re-clicking a slot or a tier clears back to all', () => {
    const weapon = toggleSlot(ALL_CATEGORIES, 'weapon');
    expect(weapon).toEqual({ slot: 'weapon', tier: null });
    expect(toggleSlot(weapon, 'weapon')).toEqual(ALL_CATEGORIES);

    const weapon3 = toggleTier(weapon, 'weapon', 3);
    expect(weapon3).toEqual({ slot: 'weapon', tier: 3 });
    expect(toggleTier(weapon3, 'weapon', 3)).toEqual(ALL_CATEGORIES);
  });

  it('a tier pick replaces the slot-only selection rather than stacking', () => {
    expect(toggleTier({ slot: 'weapon', tier: null }, 'spirit', 2)).toEqual({ slot: 'spirit', tier: 2 });
    expect(toggleSlot({ slot: 'weapon', tier: 3 }, 'weapon')).toEqual({ slot: 'weapon', tier: null });
  });

  it('titles the selection, naming Tier V as the apex', () => {
    expect(categoryTitle(ALL_CATEGORIES)).toBe('All items');
    expect(categoryTitle({ slot: 'weapon', tier: null })).toBe('Weapon');
    expect(categoryTitle({ slot: 'weapon', tier: 3 })).toBe('Weapon · Tier III');
    expect(categoryTitle({ slot: 'vitality', tier: 5 })).toBe('Vitality · Tier V · Apex');
  });
});

describe('catalog join and filter', () => {
  it('hangs slot, tier and cost off every stats row it can place', () => {
    const rows = itemIndexRows(stats, catalog);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ slot: 'weapon', tier: 1, cost: 800, slotTier: 'Weapon · I' });
    expect(rows[2]).toMatchObject({ slot: 'vitality', tier: 5, slotTier: 'Vitality · V' });
    expect(rows[3]).toMatchObject({ slot: null, tier: null, cost: null, slotTier: '' });
  });

  it('filters by slot, then by slot and tier; uncategorised rows drop out of both', () => {
    const rows = itemIndexRows(stats, catalog);
    expect(filterByCategory(rows, ALL_CATEGORIES)).toHaveLength(4);
    expect(filterByCategory(rows, { slot: 'weapon', tier: null }).map((r) => r.item_id)).toEqual([1, 2]);
    expect(filterByCategory(rows, { slot: 'weapon', tier: 4 }).map((r) => r.item_id)).toEqual([2]);
    expect(filterByCategory(rows, { slot: 'spirit', tier: null })).toEqual([]);
  });
});

describe('sort presets', () => {
  it('spells the four presets the design names', () => {
    expect(SORT_PRESETS.map((p) => p.label)).toEqual([
      'Highest WR',
      'Most bought',
      'Earliest',
      'Late spikes',
    ]);
  });

  it('Earliest and Late spikes are the same column in opposite directions', () => {
    const early = SORT_PRESETS.find((p) => p.key === 'earliest')!;
    const late = SORT_PRESETS.find((p) => p.key === 'late-spikes')!;
    expect(early.sort.key).toBe(late.sort.key);
    expect(early.sort.dir).toBe(1);
    expect(late.sort.dir).toBe(-1);
  });

  it('marks a preset active only on an exact key+direction match', () => {
    expect(activePreset({ key: 'wr', dir: -1 })?.key).toBe('top-wr');
    expect(activePreset({ key: 'wr', dir: 1 })).toBeUndefined();
    expect(activePreset({ key: 'item', dir: -1 })).toBeUndefined();
    expect(activePreset(null)).toBeUndefined();
  });
});

describe('top_hero presence', () => {
  it('is false while the item-hero fold serves nothing', () => {
    expect(hasTopHero(stats)).toBe(false);
  });

  it('is true as soon as one row carries it', () => {
    expect(hasTopHero([...stats, { item_id: 4, top_hero: { hero_id: 6, share_of_games: 12 } } as ItemStat])).toBe(true);
  });
});
