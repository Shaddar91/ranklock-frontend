import { describe, expect, it, vi } from 'vitest';
import {
  ITEM_ID_REDIRECTS,
  ITEM_SLUG_OVERRIDES,
  ITEM_SLUGS,
  itemPath,
  itemSlug,
  slugCatalog,
  slugToItemId,
} from './itemSlugs';

const rows = (...items: [number, string][]) => Object.fromEntries(items.map(([id, name]) => [String(id), { name }]));

describe('itemSlug', () => {
  it('lowercases and collapses every non-alphanumeric run to one hyphen', () => {
    expect(itemSlug('Improved Spirit')).toBe('improved-spirit');
    expect(itemSlug("Patron's Healing")).toBe('patron-s-healing');
    expect(itemSlug('Hex-Sealed Knuckles')).toBe('hex-sealed-knuckles');
    expect(itemSlug('Majestic Leap - Disabled')).toBe('majestic-leap-disabled');
  });
  it('trims edge hyphens and yields empty for a name with no alphanumerics', () => {
    expect(itemSlug(' -- Kevlar -- ')).toBe('kevlar');
    expect(itemSlug('???')).toBe('');
  });
});

describe('catalog slugs', () => {
  it('covers the 190 catalog items with unique slugs in slug form', () => {
    const slugs = Object.values(ITEM_SLUGS);
    expect(slugs).toHaveLength(190);
    expect(new Set(slugs).size).toBe(190);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
  });
  it('splits the two Silencers through the override table', () => {
    expect(ITEM_SLUG_OVERRIDES[3133167885]).toBe('silencer-active');
    expect(ITEM_SLUGS[1113837674]).toBe('silencer');
    expect(ITEM_SLUGS[3133167885]).toBe('silencer-active');
  });
  it('resolves ids and slugs both ways', () => {
    expect(itemPath(7409189)).toBe('/items/improved-spirit/');
    expect(slugToItemId('improved-spirit')).toBe(7409189);
    expect(slugToItemId('silencer-active')).toBe(3133167885);
    expect(slugToItemId('nothing')).toBeNull();
  });
  it('falls back to the numeric path for an id the catalog does not have', () => {
    expect(itemPath(1)).toBe('/items/1/');
  });
  it('maps every numeric item URL to a 301 at its slug, apex and per locale', () => {
    expect(Object.keys(ITEM_ID_REDIRECTS)).toHaveLength(190 * 7);
    expect(ITEM_ID_REDIRECTS['/items/7409189']).toEqual({ status: 301, destination: '/items/improved-spirit/' });
    expect(ITEM_ID_REDIRECTS['/ru/items/3133167885']).toEqual({ status: 301, destination: '/ru/items/silencer-active/' });
    expect(ITEM_ID_REDIRECTS['/en/items/7409189']).toBeUndefined();
    for (const [from, to] of Object.entries(ITEM_ID_REDIRECTS)) {
      expect(from).toMatch(/^(\/[a-z]{2})?\/items\/\d+$/);
      expect(to.destination).toMatch(/^(\/[a-z]{2})?\/items\/[a-z0-9-]+\/$/);
    }
  });
});

describe('slugCatalog', () => {
  it('assigns slugs and lets an override split a shared name', () => {
    expect(slugCatalog(rows([1, 'Silencer'], [2, 'Silencer']), { 2: 'silencer-active' }, 'test', true)).toEqual({
      1: 'silencer',
      2: 'silencer-active',
    });
  });
  it('refuses an unresolved collision, an empty slug and an override out of slug form', () => {
    expect(() => slugCatalog(rows([1, 'Silencer'], [2, 'SILENCER']), {}, 'test', true)).toThrow(/collides/);
    expect(() => slugCatalog(rows([1, '???']), {}, 'test', true)).toThrow(/empty string/);
    expect(() => slugCatalog(rows([1, 'Silencer']), { 1: 'Silencer Active' }, 'test', true)).toThrow(/not in slug form/);
    expect(() => slugCatalog(rows([1, 'Silencer'], [2, 'Other']), { 2: 'silencer' }, 'test', true)).toThrow(/collides/);
  });
  it('drops the offending ids instead of throwing outside a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(slugCatalog(rows([1, 'Silencer'], [2, 'Silencer'], [3, 'Kevlar']), {}, 'test', false)).toEqual({
      1: 'silencer',
      3: 'kevlar',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
