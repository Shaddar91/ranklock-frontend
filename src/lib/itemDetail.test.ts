import { describe, expect, it } from 'vitest';
import {
  BUY_HISTOGRAM,
  BUY_WR_BANDS,
  foldTiming,
  itemTags,
  mergeItemDetail,
  patchesNamingItem,
  plainItemText,
  rankPeers,
  upgradeDiscount,
  type PeerRow,
} from './itemDetail';
import { overlayFromWire } from './itemOverlay';
import type { ItemDetailResponse, ItemTimingBucket, Patch } from '../types/api';

const bucket = (b: number, matches: number, wins: number): ItemTimingBucket => ({
  bucket: b,
  matches,
  wins,
  win_rate: matches > 0 ? wins / matches : 0,
  avg_buy_time_s: b * 60,
});

describe('foldTiming', () => {
  it('folds every minute into exactly one of the 11 histogram bands', () => {
    const buckets = Array.from({ length: 60 }, (_, i) => bucket(i, 10, 5));
    const windows = foldTiming(buckets, BUY_HISTOGRAM);
    expect(windows).toHaveLength(11);
    expect(windows.reduce((n, w) => n + w.matches, 0)).toBe(600);
    expect(windows.reduce((n, w) => n + w.share, 0)).toBeCloseTo(100, 6);
  });

  it('sends every minute below 12 into the first band and everything from 30 into the last', () => {
    const windows = foldTiming([bucket(0, 7, 3), bucket(11, 5, 2), bucket(30, 4, 4), bucket(65, 6, 1)], BUY_HISTOGRAM);
    expect(windows[0]).toMatchObject({ label: '<12', matches: 12, wins: 5 });
    expect(windows[10]).toMatchObject({ label: '30+', matches: 10, wins: 5 });
  });

  it('weights a band win rate by matches, never by averaging the bucket rates', () => {
    //90% at 60% + 10% at 10% is 55%, not the plain mean 35%.
    const windows = foldTiming([bucket(12, 900, 540), bucket(13, 100, 10)], BUY_HISTOGRAM);
    expect(windows[1]?.winRate).toBeCloseTo(55, 6);
  });

  it('reports a null win rate and a zero share for a band with no purchases', () => {
    const windows = foldTiming([bucket(12, 100, 50)], BUY_HISTOGRAM);
    expect(windows[0]).toMatchObject({ matches: 0, share: 0, winRate: null });
  });

  it('folds an empty payload without dividing by zero', () => {
    expect(foldTiming([], BUY_HISTOGRAM).every((w) => w.share === 0 && w.winRate === null)).toBe(true);
  });

  it('covers the same minute axis with the 6 win-rate bands', () => {
    const buckets = Array.from({ length: 40 }, (_, i) => bucket(i, 3, 2));
    const windows = foldTiming(buckets, BUY_WR_BANDS);
    expect(windows).toHaveLength(6);
    expect(windows.reduce((n, w) => n + w.matches, 0)).toBe(120);
  });
});

describe('itemTags', () => {
  it('names the family a modifier puts the item in', () => {
    expect(itemTags([{ property_type: 'MODIFIER_VALUE_STATUS_RESISTANCE', value: 25, is_percent: true }])).toEqual([
      'Against crowd control',
    ]);
  });

  it('requires the family sign, so a positive heal-amp modifier is not an anti-heal tag', () => {
    expect(itemTags([{ property_type: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT', value: 12, is_percent: true }])).toEqual([]);
    expect(itemTags([{ property_type: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT', value: -40, is_percent: true }])).toEqual([
      'Against healing',
    ]);
  });

  it('returns no tag for an item outside every family', () => {
    expect(itemTags([{ property_type: 'MODIFIER_VALUE_HEALTH_MAX', value: 90, is_percent: false }])).toEqual([]);
    expect(itemTags(null)).toEqual([]);
  });
});

describe('upgradeDiscount', () => {
  it('subtracts every owned component from the shop price', () => {
    expect(upgradeDiscount(3200, [1600])).toBe(1600);
    expect(upgradeDiscount(6400, [1600, 1600])).toBe(3200);
  });

  it('stays null when the item has no components or no price', () => {
    expect(upgradeDiscount(3200, [])).toBeNull();
    expect(upgradeDiscount(null, [1600])).toBeNull();
    expect(upgradeDiscount(3200, [null])).toBeNull();
  });
});

describe('rankPeers', () => {
  const peer = (itemId: number, name: string, winRate: number | null): PeerRow => ({
    itemId,
    name,
    icon: null,
    winRate,
    matches: 100,
  });

  it('drops the item itself and sorts the rest by win rate', () => {
    const rows = rankPeers([peer(1, 'A', 51), peer(2, 'Self', 60), peer(3, 'C', 53)], 2);
    expect(rows.map((r) => r.name)).toEqual(['C', 'A']);
  });

  it('keeps rateless peers last instead of treating them as 0%', () => {
    const rows = rankPeers([peer(1, 'Rateless', null), peer(2, 'Rated', 48)], 99);
    expect(rows.map((r) => r.name)).toEqual(['Rated', 'Rateless']);
  });

  it('caps the list at the requested length', () => {
    const many = Array.from({ length: 20 }, (_, i) => peer(i + 10, `P${i}`, 50 + i));
    expect(rankPeers(many, 1, 7)).toHaveLength(7);
  });
});

describe('patchesNamingItem', () => {
  const patch = (patch_id: string, notes_summary: string | null): Patch => ({
    patch_id,
    version_label: patch_id,
    released_at: `${patch_id}T00:00:00Z`,
    ended_at: null,
    notes_url: null,
    notes_summary,
    is_current: false,
  });

  it('matches the item name case-insensitively inside the served summary', () => {
    const rows = patchesNamingItem(
      [patch('2026-08-22', 'debuff reducer resist lowered'), patch('2026-08-12', 'Unrelated change')],
      'Debuff Reducer',
    );
    expect(rows.map((p) => p.patch_id)).toEqual(['2026-08-22']);
  });

  it('matches nothing when the summary is absent or the name is empty', () => {
    expect(patchesNamingItem([patch('2026-08-22', null)], 'Debuff Reducer')).toEqual([]);
    expect(patchesNamingItem([patch('2026-08-22', 'anything')], '')).toEqual([]);
  });
});

describe('plainItemText', () => {
  it('flattens Valve markup and entities to one line of text', () => {
    expect(
      plainItemText('Reduces the <span class="highlight">duration</span> of<br>all <b>negative</b> effects &amp; debuffs.'),
    ).toBe('Reduces the duration of all negative effects & debuffs.');
  });

  it('returns null for absent or markup-only text', () => {
    expect(plainItemText(null)).toBeNull();
    expect(plainItemText('<br>')).toBeNull();
  });
});

describe('mergeItemDetail — the hover card over GET /items/:id/detail', () => {
  const base = overlayFromWire(
    {
      item_id: 100,
      item_name: 'Debuff Reducer',
      item_slot_type: 'vitality',
      item_tier: 2,
      cost: 1600,
      shop_image_webp: 'https://cdn.example/images/items/vitality/debuff_reducer.webp',
      modifiers: [{ property_type: 'P', value: 12, is_percent: true, label: 'Debuff Resist' }],
    },
    {},
  );

  const detail: ItemDetailResponse = {
    item_id: 100,
    class_name: 'upgrade_debuff_reducer',
    item_name: 'Debuff Reducer',
    item_slot_type: 'vitality',
    item_tier: 2,
    cost: 1600,
    shop_image_webp: null,
    is_shop_item: true,
    modifiers: [],
    activation: 'instant_cast',
    is_active_item: true,
    cooldown: 48,
    text: { desc: 'Cleanses <b>negative</b> effects.', passive: 'Reduces debuff duration.', active: 'Cleanse yourself.' },
    text_key: 'citadel_upgrade_debuff_reducer',
    components: [{ item_id: 10, class_name: 'c', item_name: 'Extra Regen', icon_url: null }],
    builds_into: [{ item_id: 900, class_name: 'p', item_name: 'Debuff Remover', icon_url: null }],
    source: 'assets',
  };

  it('folds in the component tree both ways, the cooldown and Valve’s split text', () => {
    const card = mergeItemDetail(base, detail);
    expect(card.upgradesFrom.map((u) => u.name)).toEqual(['Extra Regen']);
    expect(card.upgradesInto.map((u) => u.name)).toEqual(['Debuff Remover']);
    expect(card.cooldown).toBe(48);
    expect(card.ability?.active).toBe(true);
    expect(card.ability?.desc).toBe('Cleanse yourself.');
    expect(card.ability?.passive).toBe('Reduces debuff duration.');
  });

  it('keeps the catalog modifiers — the detail route serves them unlabelled', () => {
    expect(mergeItemDetail(base, detail).modifiers).toEqual(base.modifiers);
  });

  it('returns the bundled card untouched while the route has not answered', () => {
    expect(mergeItemDetail(base, undefined)).toBe(base);
  });

  it('leaves a passive item with no cooldown and no parents', () => {
    const passive = mergeItemDetail(base, {
      ...detail,
      is_active_item: false,
      cooldown: undefined,
      text: { passive: 'Always on.' },
      builds_into: [],
    });
    expect(passive.cooldown).toBeNull();
    expect(passive.ability?.active).toBe(false);
    expect(passive.ability?.passive).toBe('Always on.');
    expect(passive.upgradesInto).toEqual([]);
  });
});
