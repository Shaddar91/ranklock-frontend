import { describe, it, expect } from 'vitest';
import upgradesData from '../data/item-upgrades.json';
import catalogData from '../data/items-catalog.json';
import {
  isBrawlAsset,
  toModifierRows,
  formatModifier,
  upgradesFor,
  overlayFromWire,
  overlayFromCatalog,
  splitBrawl,
  type UpgradesMap,
} from './itemOverlay';
import type { ItemModifier } from '../types/api';

const BRAWL_ICON = 'https://cdn.example/assets-api-res/images/items/brawl/shrink_ray.webp';
const SHOP_ICON = 'https://cdn.example/assets-api-res/images/items/weapon/basic_magazine.webp';

describe('isBrawlAsset — the only wire signal for Street Brawl items', () => {
  it('matches the brawl shop-art path', () => {
    expect(isBrawlAsset(BRAWL_ICON)).toBe(true);
  });
  it('rejects competitive shop art and empty values', () => {
    expect(isBrawlAsset(SHOP_ICON)).toBe(false);
    expect(isBrawlAsset(null)).toBe(false);
    expect(isBrawlAsset(undefined)).toBe(false);
    expect(isBrawlAsset('')).toBe(false);
  });
});

describe('toModifierRows — wire unknown[] → typed rows', () => {
  it('maps well-formed rows and defaults label/is_percent', () => {
    const rows = toModifierRows([
      { property_type: 'MODIFIER_VALUE_X', value: 8, is_percent: true, label: 'Weapon Damage' },
      { property_type: 'MODIFIER_VALUE_Y', value: -5 },
    ]);
    expect(rows).toEqual([
      { property_type: 'MODIFIER_VALUE_X', value: 8, is_percent: true, label: 'Weapon Damage' },
      { property_type: 'MODIFIER_VALUE_Y', value: -5, is_percent: false, label: null },
    ]);
  });
  it('drops malformed entries instead of crashing the card', () => {
    expect(
      toModifierRows([null, 42, 'x', { value: 3 }, { property_type: 'P' }, { property_type: 'P', value: 'NaN' }]),
    ).toEqual([]);
    expect(toModifierRows(null)).toEqual([]);
    expect(toModifierRows(undefined)).toEqual([]);
  });
});

describe('formatModifier', () => {
  it('signs positives, keeps negatives, appends % only for percent rows', () => {
    expect(formatModifier({ property_type: 'P', value: 8, is_percent: true, label: 'Weapon Damage' })).toBe('+8% Weapon Damage');
    expect(formatModifier({ property_type: 'P', value: -5, is_percent: false, label: 'Move Speed' })).toBe('-5 Move Speed');
    expect(formatModifier({ property_type: 'P', value: 2.25, is_percent: false, label: 'Regen' })).toBe('+2.3 Regen');
  });
  it('falls back to a bare value when the label is missing', () => {
    expect(formatModifier({ property_type: 'P', value: 10, is_percent: false, label: null })).toBe('+10');
  });
});

describe('upgradesFor — lineage resolution', () => {
  const MAP: UpgradesMap = { '100': [200, 300] };

  it('resolves refs and falls back to "Item <id>" for names outside the catalog', () => {
    const refs = upgradesFor(100, MAP);
    expect(refs.map((r) => r.id)).toEqual([200, 300]);
    expect(refs[0]?.name).toBe('Item 200');
  });
  it('returns [] for unknown or null ids', () => {
    expect(upgradesFor(999, MAP)).toEqual([]);
    expect(upgradesFor(null, MAP)).toEqual([]);
    expect(upgradesFor(undefined, MAP)).toEqual([]);
  });
});

describe('overlay mapping — both surfaces feed one card model', () => {
  const wire: ItemModifier = {
    item_id: 100,
    item_name: 'Headshot Booster',
    item_slot_type: 'weapon',
    item_tier: 1,
    cost: 800,
    shop_image_webp: SHOP_ICON,
    modifiers: [{ property_type: 'P', value: 8, is_percent: true, label: 'Weapon Damage' }],
  };

  it('overlayFromWire maps fields, parses modifiers, resolves lineage', () => {
    const d = overlayFromWire(wire, { '100': [200] });
    expect(d).toMatchObject({
      id: 100,
      name: 'Headshot Booster',
      icon: SHOP_ICON,
      slot: 'weapon',
      tier: 1,
      cost: 800,
      brawl: false,
    });
    expect(d.modifiers).toEqual([{ property_type: 'P', value: 8, is_percent: true, label: 'Weapon Damage' }]);
    expect(d.upgradesFrom.map((u) => u.id)).toEqual([200]);
  });
  it('flags brawl rows and names a nameless row by id', () => {
    const d = overlayFromWire({ ...wire, item_name: null, shop_image_webp: BRAWL_ICON }, {});
    expect(d.brawl).toBe(true);
    expect(d.name).toBe('Item 100');
    expect(d.upgradesFrom).toEqual([]);
  });
  it('overlayFromCatalog maps the creator row shape (already-typed modifiers)', () => {
    const d = overlayFromCatalog(
      {
        item_id: 100,
        item_name: 'Headshot Booster',
        item_slot_type: 'weapon',
        item_tier: 1,
        cost: 800,
        icon: BRAWL_ICON,
        modifiers: [{ property_type: 'P', value: 8, is_percent: true, label: 'Weapon Damage' }],
      },
      {},
    );
    expect(d.brawl).toBe(true);
    expect(d.icon).toBe(BRAWL_ICON);
    expect(d.modifiers).toHaveLength(1);
  });
});

describe('splitBrawl — competitive vs Street Brawl, never mixed', () => {
  it('partitions by icon path and preserves order', () => {
    const rows = [
      { id: 1, icon: SHOP_ICON },
      { id: 2, icon: BRAWL_ICON },
      { id: 3, icon: null },
      { id: 4, icon: BRAWL_ICON },
    ];
    const { competitive, brawl } = splitBrawl(rows, (r) => r.icon);
    expect(competitive.map((r) => r.id)).toEqual([1, 3]);
    expect(brawl.map((r) => r.id)).toEqual([2, 4]);
  });
  it('sends every row to competitive when nothing is brawl', () => {
    const { competitive, brawl } = splitBrawl([{ icon: SHOP_ICON }], (r) => r.icon);
    expect(competitive).toHaveLength(1);
    expect(brawl).toHaveLength(0);
  });
});

describe('item-upgrades.json — generated lineage invariants', () => {
  const upgrades = upgradesData as Record<string, number[]>;
  const catalog = catalogData as Record<string, { name: string; icon: string | null }>;

  it('is non-empty and every entry is a non-empty numeric id array', () => {
    const entries = Object.entries(upgrades);
    expect(entries.length).toBeGreaterThan(0);
    for (const [k, comps] of entries) {
      expect(Number.isFinite(Number(k))).toBe(true);
      expect(comps.length).toBeGreaterThan(0);
      for (const cid of comps) expect(Number.isFinite(cid)).toBe(true);
    }
  });
  it('every key and every component id resolves in the bundled catalog', () => {
    for (const [k, comps] of Object.entries(upgrades)) {
      expect(catalog[k]).toBeDefined();
      for (const cid of comps) expect(catalog[String(cid)]).toBeDefined();
    }
  });
});

describe('ability — the active / imbue facts the wire drops', () => {
  //Fleetfoot is the one shop item whose feed entry splits into an active line and a
  //passive rider; if the generated map ever loses that, the overlay silently goes quiet.
  const FLEETFOOT = 3403085434;

  it('carries the active flag, the headline and the passive rider', () => {
    const card = overlayFromCatalog({
      item_id: FLEETFOOT,
      item_name: 'Fleetfoot',
      item_slot_type: 'weapon',
      item_tier: 2,
      cost: 1600,
      icon: SHOP_ICON,
      modifiers: [],
    });
    expect(card.ability?.active).toBe(true);
    expect(card.ability?.desc).toMatch(/Move Speed/);
    expect(card.ability?.passive).toMatch(/while shooting/);
  });

  it('is null for an item the feed describes nowhere', () => {
    const card = overlayFromCatalog({
      item_id: 1,
      item_name: 'Nothing',
      item_slot_type: 'weapon',
      item_tier: 1,
      cost: 800,
      icon: SHOP_ICON,
      modifiers: [],
    });
    expect(card.ability).toBeNull();
  });
});
