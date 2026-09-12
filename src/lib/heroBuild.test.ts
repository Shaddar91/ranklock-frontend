import { describe, it, expect } from 'vitest';
import {
  affordableAtMinute,
  buildByPhase,
  buyOrderTrack,
  catalogIndex,
  RANKED_BRACKETS,
  rankedBracketLabel,
  situationalGroups,
  winningSets,
} from './heroBuild';
import type { BuildStatsItemSet, HeroItemWinRate, ItemModifier, ItemStat, LaneCurvePoint } from '../types/api';

const mod = (
  item_id: number,
  item_name: string,
  cost: number,
  modifiers: unknown[] = [],
  item_tier = 2,
): ItemModifier => ({
  item_id,
  item_name,
  item_slot_type: 'weapon',
  item_tier,
  shop_image_webp: null,
  cost,
  modifiers,
});

const stat = (item_id: number, item_name: string, matches: number, avg_buy_time_s: number, win_rate = 51): ItemStat =>
  ({ item_id, item_name, icon_url: null, matches, win_rate, avg_buy_time_s }) as ItemStat;

const curve = (pairs: [number, number][]): LaneCurvePoint[] =>
  pairs.map(([min, kilosouls]) => ({
    minute_bucket: min / 3,
    t_seconds: min * 60,
    sample_players: 1000,
    p25: kilosouls,
    p50: kilosouls,
    p75: kilosouls,
  }));

describe('affordableAtMinute — cumulative cost against the p50 souls curve', () => {
  const pts = curve([
    [3, 1.7],
    [6, 3.7],
    [9, 6.0],
  ]);

  it('interpolates between grid points instead of snapping to one', () => {
    const at = affordableAtMinute(pts, 4700) as number;
    expect(at).toBeGreaterThan(6);
    expect(at).toBeLessThan(9);
  });

  it('anchors the first segment on the 600-soul game start, never on zero', () => {
    expect(affordableAtMinute(pts, 600)).toBe(0);
    expect(affordableAtMinute(pts, 1150)).toBeCloseTo(1.5, 1);
  });

  it('returns null for a total the curve never reaches, rather than the last minute', () => {
    expect(affordableAtMinute(pts, 40_000)).toBeNull();
    expect(affordableAtMinute([], 1000)).toBeNull();
  });
});

describe('buildByPhase — bands, core pill and phase cost', () => {
  const catalog = catalogIndex([mod(1, 'Rapid Rounds', 800), mod(2, 'Ricochet', 6400), mod(3, 'Headshot', 3200)]);
  const rows = [stat(1, 'Rapid Rounds', 400_000, 280), stat(2, 'Ricochet', 350_000, 1500), stat(3, 'Headshot', 90_000, 900)];

  it('puts each item in the band its own rendered minute falls in', () => {
    const phases = buildByPhase(rows, catalog);
    expect(phases.map((p) => p.items.map((i) => i.name))).toEqual([['Rapid Rounds'], ['Headshot'], ['Ricochet']]);
  });

  it('calls an item core only at or above 60% of the most-bought item games', () => {
    const phases = buildByPhase(rows, catalog);
    expect(phases[2]?.items[0]?.core).toBe(true);
    expect(phases[1]?.items[0]?.core).toBe(false);
  });

  it('sums the phase cost from the catalog and reports null when nothing is costed', () => {
    expect(buildByPhase(rows, catalog)[2]?.souls).toBe(6400);
    expect(buildByPhase(rows, catalogIndex([]))[2]?.souls).toBeNull();
  });
});

describe('buyOrderTrack — most-bought items in buy-minute order with a running total', () => {
  const catalog = catalogIndex([mod(1, 'Rapid Rounds', 800), mod(2, 'Ricochet', 6400), mod(3, 'Headshot', 3200)]);
  const rows = [stat(2, 'Ricochet', 350_000, 1500), stat(1, 'Rapid Rounds', 400_000, 280), stat(3, 'Headshot', 90_000, 900)];

  it('orders the slots by buy minute and accumulates the board cost', () => {
    const track = buyOrderTrack(rows, catalog, curve([[30, 30]]));
    expect(track.map((s) => [s.pos, s.name, s.cumulative])).toEqual([
      [1, 'Rapid Rounds', 800],
      [2, 'Headshot', 4000],
      [3, 'Ricochet', 10_400],
    ]);
  });

  it('keeps only the most-bought items when the roster is longer than the board', () => {
    expect(buyOrderTrack(rows, catalog, [], 2).map((s) => s.name)).toEqual(['Rapid Rounds', 'Ricochet']);
  });

  it('drops an item the catalog carries no cost for', () => {
    expect(buyOrderTrack(rows, catalogIndex([mod(1, 'Rapid Rounds', 800)]), []).map((s) => s.name)).toEqual([
      'Rapid Rounds',
    ]);
  });
});

describe('situationalGroups — modifier families ranked by this hero win rate', () => {
  const catalog: ItemModifier[] = [
    mod(1, 'Healbane', 1600, [{ property_type: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT', value: -35, is_percent: true, label: 'Healing Reduction' }]),
    mod(2, 'Decay', 3200, [{ property_type: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT', value: -50, is_percent: true, label: 'Healing Reduction' }]),
    mod(3, 'Heal Booster', 1600, [{ property_type: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT', value: 20, is_percent: true, label: 'Healing' }]),
    mod(4, 'Battle Vest', 1600, [{ property_type: 'MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST', value: 18, is_percent: true, label: 'Bullet Resist' }]),
  ];
  const wrs: HeroItemWinRate[] = [
    { item_id: 1, games: 500, wins: 260, win_rate: 0.52, wilson_lower: 0.48 } as HeroItemWinRate,
    { item_id: 2, games: 900, wins: 500, win_rate: 0.555, wilson_lower: 0.53 } as HeroItemWinRate,
    { item_id: 3, games: 900, wins: 500, win_rate: 0.555, wilson_lower: 0.53 } as HeroItemWinRate,
  ];

  it('ranks a family by Wilson lower bound and renders the modifier that put the item there', () => {
    const groups = situationalGroups(catalog, wrs);
    expect(groups[0]?.label).toBe('Against healing');
    expect(groups[0]?.picks.map((p) => p.name)).toEqual(['Decay', 'Healbane']);
    expect(groups[0]?.picks[0]?.modifier).toBe('-50% Healing Reduction');
  });

  it('reads the property sign, so a healing buff never lands in the anti-heal group', () => {
    const names = situationalGroups(catalog, wrs).flatMap((g) => g.picks.map((p) => p.name));
    expect(names).not.toContain('Heal Booster');
  });

  it('omits a family whose items this hero has no measured win rate for', () => {
    expect(situationalGroups(catalog, wrs).map((g) => g.key)).toEqual(['healing']);
  });
});

describe('winningSets — the folded purchase sets, abilities flagged not filtered', () => {
  const catalog = catalogIndex([mod(10, 'Swift Striker', 3200)]);
  const sets: BuildStatsItemSet[] = [
    {
      items: [
        { item_id: 99, item_name: 'Fixation', icon_url: null },
        { item_id: 99, item_name: 'Fixation', icon_url: null },
        { item_id: 10, item_name: 'Swift Striker', icon_url: null },
      ],
      games: 1672,
      wins: 896,
      win_rate: 0.5358,
      wilson_lower: 0.5119,
    },
    { items: [{ item_id: 10, item_name: 'Swift Striker', icon_url: null }], games: 900, wins: 460, win_rate: 0.511, wilson_lower: 0.49 },
  ];

  it('collapses a repeated purchase into one entry carrying its count', () => {
    const [first] = winningSets(sets, catalog);
    expect(first?.entries.map((e) => [e.name, e.count])).toEqual([
      ['Fixation', 2],
      ['Swift Striker', 1],
    ]);
  });

  it('flags an entry the shop catalog does not carry as an ability upgrade', () => {
    const [first] = winningSets(sets, catalog);
    expect(first?.entries.map((e) => e.shopItem)).toEqual([false, true]);
  });

  it('sorts by Wilson lower bound, not by raw win rate', () => {
    expect(winningSets(sets, catalog).map((s) => s.games)).toEqual([1672, 900]);
  });
});

describe('RANKED_BRACKETS — the served keys stay spelled by the pinned ladder', () => {
  it('names every bracket from ranks.ts, so a ladder rename cannot desync the key', () => {
    for (const option of RANKED_BRACKETS) {
      const slug = rankedBracketLabel(option).toLowerCase().replace(/\s–\s/, '-');
      expect(slug).toBe(option.key);
    }
  });
});

describe('situationalGroups — the slow family renames its own modifier', () => {
  it('says "move-speed slow", never the catalog "Move Speed" that reads as a buff', () => {
    const catalog: ItemModifier[] = [
      {
        item_id: 7,
        item_name: 'Mystic Reverb',
        item_slot_type: 'spirit',
        item_tier: 4,
        shop_image_webp: null,
        cost: 6400,
        modifiers: [{ property_type: 'MODIFIER_VALUE_MOVEMENT_SPEED_SLOW_PERCENT', value: 40, is_percent: true, label: 'Move Speed' }],
      },
    ];
    const wrs = [{ item_id: 7, games: 500, wins: 300, win_rate: 0.6, wilson_lower: 0.56 } as HeroItemWinRate];
    expect(situationalGroups(catalog, wrs)[0]?.picks[0]?.modifier).toBe('+40% move-speed slow');
  });
});
