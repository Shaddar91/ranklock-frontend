//Golden tests for the Create-tab model: the order editor's 4-points rule and its served-rate
//lookup, the inverted board-cost delta, the timeline's slow/fast window, and the rate provenance
//that decides whether a compare column may show a win rate at all.
import { describe, it, expect } from 'vitest';
import {
  ORDER_POINTS,
  POINTS_PER_ABILITY,
  cohortCurvePoints,
  compareRows,
  cycleOrder,
  initialOrder,
  matchOrderRate,
  orderAbilityIds,
  orderIsValid,
  ownCurvePoints,
  slotCounts,
  startFromPresets,
  timelineRows,
  trackPercent,
} from './createModel';
import type { ComputedStats } from '../../../lib/computeStats';
import type { AbilityOrder, HeroBuildStats, LaneCurvePoint, TrimmedBuild } from '../../../types/api';
import type { CatalogItem } from '../creator/buildModel';
import type { PurchaseRow } from './analyzeModel';

const ABILITY_IDS = [11, 22, 33, 44];

function stats(over: Partial<ComputedStats> = {}): ComputedStats {
  return {
    weapon: [],
    vitality: [],
    spirit: [],
    perAbility: {},
    spend: { weapon: 0, vitality: 0, spirit: 0, flex: 0, total: 0, effectiveTotal: 0 },
    investment: null,
    levelScaling: null,
    weaponDps: null,
    ...over,
  };
}

function line(key: string, value: number, category: 'weapon' | 'vitality' | 'spirit', unit: 'flat' | 'percent' = 'flat') {
  return { key, label: key, category, unit, base: 0, value, delta: value };
}

describe('createModel — ability-order editor', () => {
  it('opens on a valid order: 16 points, four each', () => {
    const order = initialOrder();
    expect(order).toHaveLength(ORDER_POINTS);
    expect(slotCounts(order)).toEqual([4, 4, 4, 4]);
    expect(orderIsValid(order)).toBe(true);
  });

  it('cycles one point 1→2→3→4→1 and leaves the rest alone', () => {
    let order = initialOrder();
    expect(order[0]).toBe(1);
    for (const expected of [2, 3, 4, 1]) {
      order = cycleOrder(order, 0);
      expect(order[0]).toBe(expected);
    }
    expect(order.slice(1)).toEqual(initialOrder().slice(1));
  });

  it('an ability off its four points is invalid', () => {
    const order = cycleOrder(initialOrder(), 0); //ability 1 → 3 points, ability 2 → 5
    expect(slotCounts(order)).toEqual([3, 5, 4, 4]);
    expect(orderIsValid(order)).toBe(false);
  });

  it('maps slots onto the hero ability ids, and refuses when fewer than four are served', () => {
    expect(orderAbilityIds([1, 2, 3, 4], ABILITY_IDS)).toEqual([11, 22, 33, 44]);
    expect(orderAbilityIds([1, 2, 3, 4], [11, 22, 33])).toEqual([]);
  });
});

describe('createModel — served-rate lookup', () => {
  const exact: AbilityOrder = {
    abilities: orderAbilityIds(initialOrder(), ABILITY_IDS),
    wins: 900,
    losses: 700,
    matches: 1600,
    players: 1200,
    win_rate: 0.5625,
  };

  it('an invalid order is never looked up — no rate, never a number', () => {
    expect(matchOrderRate(cycleOrder(initialOrder(), 0), ABILITY_IDS, [exact])).toBeNull();
  });

  it('an exact match returns the served row with no prefix', () => {
    const m = matchOrderRate(initialOrder(), ABILITY_IDS, [exact])!;
    expect(m.prefix).toBeNull();
    expect(m.order.matches).toBe(1600);
  });

  it('tolerates a 15-long served order by matching on its own prefix', () => {
    const served: AbilityOrder = { ...exact, abilities: exact.abilities.slice(0, 15) };
    const m = matchOrderRate(initialOrder(), ABILITY_IDS, [served])!;
    expect(m.prefix).toBe(15);
  });

  it('a valid order upstream does not carry has no rate', () => {
    const other: AbilityOrder = { ...exact, abilities: [...exact.abilities].reverse() };
    expect(matchOrderRate(initialOrder(), ABILITY_IDS, [other])).toBeNull();
    expect(matchOrderRate(initialOrder(), ABILITY_IDS, undefined)).toBeNull();
  });

  it('each ability holds exactly POINTS_PER_ABILITY points — one unlock and three tiers', () => {
    expect(POINTS_PER_ABILITY * 4).toBe(ORDER_POINTS);
  });
});

describe('createModel — compare boards', () => {
  const a = stats({
    vitality: [line('max_health', 1200, 'vitality')],
    spend: { weapon: 0, vitality: 4000, spirit: 0, flex: 0, total: 4000, effectiveTotal: 4000 },
  });
  const b = stats({
    vitality: [line('max_health', 1000, 'vitality')],
    spend: { weapon: 0, vitality: 6000, spirit: 0, flex: 0, total: 6000, effectiveTotal: 6000 },
  });

  it('more health favours A', () => {
    const row = compareRows(a, b).find((r) => r.key === 'max_health')!;
    expect(row.delta).toBe(200);
    expect(row.better).toBe('a');
  });

  it('board cost inverts — the cheaper board takes the row', () => {
    const row = compareRows(a, b).find((r) => r.key === 'board_cost')!;
    expect(row.delta).toBe(-2000);
    expect(row.better).toBe('a');
  });

  it('an equal row favours neither', () => {
    expect(compareRows(a, a).every((r) => r.better === null)).toBe(true);
  });
});

describe('createModel — start-from rates come only from a scored source', () => {
  const byId = new Map<number, CatalogItem>(
    [1, 2, 3].map((id) => [id, { item_id: id, item_name: `I${id}`, item_slot_type: 'weapon', item_tier: 1, cost: 800, icon: null, modifiers: [] }]),
  );
  const buildStats = {
    hero_id: 1,
    tier: 0,
    match_mode: 'Ranked',
    game_mode: 'Normal',
    item_sets: [{ items: [{ item_id: 1 }, { item_id: 2 }], games: 900, wins: 500, win_rate: 0.55, wilson_lower: 0.52 }],
    buy_order: [{ item_id: 3, pos: 1, games: 400, wins: 210, win_rate: 0.52, wilson_lower: 0.49 }],
  } as unknown as HeroBuildStats;

  it('a served item set carries its rate and window', () => {
    const set = startFromPresets(buildStats, undefined, byId).find((p) => p.key === 'winning-set')!;
    expect(set.itemIds).toEqual([1, 2]);
    expect(set.rate).toMatchObject({ matches: 900 });
    expect(set.rate!.winRate).toBeCloseTo(55);
    expect(set.rate!.window).not.toBe('');
  });

  it('a board assembled from per-item buy-order rows carries no set rate', () => {
    const preset = startFromPresets(buildStats, undefined, byId).find((p) => p.key === 'most-bought')!;
    expect(preset.itemIds).toEqual([3]);
    expect(preset.rate).toBeNull();
  });

  it('a published build with no served 30-day row carries no rate', () => {
    const build = { name: 'b', categories: [{ name: 'c', items: [{ item_id: 1 }] }], win_rate_30d: null, matches: null } as unknown as TrimmedBuild;
    const preset = startFromPresets(buildStats, build, byId).find((p) => p.key === 'community')!;
    expect(preset.itemIds).toEqual([1]);
    expect(preset.rate).toBeNull();
  });
});

describe('createModel — souls timeline', () => {
  //The served curve is in THOUSANDS of souls: 12 at 10:00, 24 at 20:00.
  const served = [
    { minute_bucket: 1, t_seconds: 0, sample_players: 10, p25: 0, p50: 0, p75: 0 },
    { minute_bucket: 2, t_seconds: 600, sample_players: 10, p25: 9, p50: 12, p75: 15 },
    { minute_bucket: 3, t_seconds: 1200, sample_players: 10, p25: 18, p50: 24, p75: 30 },
  ] as LaneCurvePoint[];
  const curve = cohortCurvePoints(served);
  const rows = [{ pos: 1, itemId: 1, name: 'I1', item: undefined, running: 12000 } as unknown as PurchaseRow];

  it('scales every percentile out of thousands into souls', () => {
    expect(curve[1]).toMatchObject({ t_seconds: 600, p25: 9000, p50: 12000, p75: 15000 });
  });

  it('the bar runs fast (×0.85 cost) → slow (×1.2 cost) on the median curve', () => {
    const [row] = timelineRows(rows, curve, 'p50', []);
    expect(row!.fast!.tSeconds).toBe(510); //10,200 souls
    expect(row!.slow!.tSeconds).toBe(720); //14,400 souls
    expect(row!.fast!.tSeconds).toBeLessThan(row!.slow!.tSeconds);
  });

  it('the dot follows the selected percentile', () => {
    expect(timelineRows(rows, curve, 'p25', [])[0]!.at!.tSeconds).toBe(800);
    expect(timelineRows(rows, curve, 'p50', [])[0]!.at!.tSeconds).toBe(600);
    expect(timelineRows(rows, curve, 'p75', [])[0]!.at!.tSeconds).toBe(480);
  });

  it('"You" reads the player\'s own curve, not the cohort', () => {
    const own = ownCurvePoints([
      { t_seconds: 300, value: 6000 },
      { t_seconds: 600, value: 18000 },
    ]);
    expect(timelineRows(rows, curve, 'you', own)[0]!.at!.tSeconds).toBe(450);
    //no own curve ⇒ no dot, never a silent fallback to the cohort
    expect(timelineRows(rows, curve, 'you', [])[0]!.at).toBeNull();
  });

  it('never places a purchase past the end of the 40-minute track', () => {
    expect(trackPercent(null)).toBeNull();
    expect(trackPercent({ tSeconds: 2400, percentile: 'p50', interpolated: false })).toBe(100);
    expect(trackPercent({ tSeconds: 2401, percentile: 'p50', interpolated: false })).toBeNull();
    expect(trackPercent({ tSeconds: 600, percentile: 'p50', interpolated: false })).toBe(25);
  });
});
