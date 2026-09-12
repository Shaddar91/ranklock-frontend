//Create-tab model: the shared "start from" presets, the 16-point order editor, the A-vs-B compare
//rows and the souls-timeline geometry. Pure — no React, no I/O; renderers add no arithmetic.
import { affordableAt, affordableWindow, type AffordableAt, type CurvePointLike } from '../../../lib/labCalc';
import { TOTAL_SLOTS, type CatalogItem } from '../creator/buildModel';
import { buildContents, matchOrderSequence, type OrderMatch, type PurchaseRow } from './analyzeModel';
import type { ComputedStats } from '../../../lib/computeStats';
import type { AbilityOrder, HeroBuildStats, LaneCurvePoint, TrimmedBuild } from '../../../types/api';

//---- §3 / §8 "start from" presets

export interface PresetRate {
  winRate: number;
  matches: number;
  //printed verbatim beside the rate — a rate with no window is not renderable (brief §5).
  window: string;
}

export interface StartFromPreset {
  key: string;
  label: string;
  hint: string;
  itemIds: number[];
  //only a served set or a published build carries a rate; a hand-filled board never does (§16).
  rate: PresetRate | null;
}

const SET_WINDOW = 'RankLock public matches · all ranks · served item sets';
const BUY_WINDOW = 'RankLock public matches · all ranks · served buy order';
const COMMUNITY_WINDOW = 'rolling 30 days, lobby-average badge floor';

export function startFromPresets(
  buildStats: HeroBuildStats | undefined,
  community: TrimmedBuild & { win_rate_30d?: number | null; matches?: number | null } | undefined,
  byId: ReadonlyMap<number, CatalogItem>,
): StartFromPreset[] {
  const shop = (ids: number[]) => [...new Set(ids)].filter((id) => byId.has(id)).slice(0, TOTAL_SLOTS);
  const buyOrder = buildStats?.buy_order ?? [];
  const sets = [...(buildStats?.item_sets ?? [])].sort((a, b) => b.wilson_lower - a.wilson_lower);
  const best = sets[0];
  const communityRate =
    community && community.win_rate_30d != null && community.matches != null
      ? { winRate: community.win_rate_30d * 100, matches: community.matches, window: COMMUNITY_WINDOW }
      : null;
  const byGames = [...buyOrder].sort((a, b) => b.games - a.games);
  const byWilson = [...buyOrder].sort((a, b) => b.wilson_lower - a.wilson_lower);
  return [
    {
      key: 'most-bought',
      label: 'Most bought',
      hint: 'The items bought most often on this hero — RankLock public matches',
      itemIds: shop(byGames.map((r) => r.item_id)),
      //a buy-order row's rate is per ITEM, never the set's — so the assembled board carries none.
      rate: null,
    },
    {
      key: 'best-wr',
      label: 'Best-WR items',
      hint: 'Highest Wilson-lower win rate among the same buys — RankLock public matches',
      itemIds: shop(byWilson.map((r) => r.item_id)),
      rate: null,
    },
    {
      key: 'winning-set',
      label: 'Winning set #1',
      hint: 'The best-scoring served item set for this hero',
      itemIds: shop((best?.items ?? []).map((i) => i.item_id)),
      rate: best ? { winRate: best.win_rate * 100, matches: best.games, window: SET_WINDOW } : null,
    },
    {
      key: 'community',
      label: 'Community build',
      hint: community ? `Trending published build: ${community.name}` : 'No published build served yet',
      itemIds: shop(community ? buildContents(community).entries.map((e) => e.itemId) : []),
      rate: communityRate,
    },
  ];
}

export const PRESET_SOURCE_NOTE = `Set rates: ${SET_WINDOW}. Buy-order presets carry no set rate — ${BUY_WINDOW} scores one item at a time.`;

//---- §11 ability-order editor

export const ORDER_POINTS = 16;
export const POINTS_PER_ABILITY = 4;
export const ABILITY_SLOTS = [1, 2, 3, 4] as const;

export const ORDER_RULE = 'Each ability takes exactly 4 points: one unlock and three tiers.';

/** A valid opening order — each ability once per round of four. */
export function initialOrder(): number[] {
  return Array.from({ length: ORDER_POINTS }, (_, i) => (i % POINTS_PER_ABILITY) + 1);
}

export function cycleOrder(order: readonly number[], index: number): number[] {
  return order.map((v, i) => (i === index ? (v % POINTS_PER_ABILITY) + 1 : v));
}

export function slotCounts(order: readonly number[]): number[] {
  return ABILITY_SLOTS.map((slot) => order.filter((v) => v === slot).length);
}

export function orderIsValid(order: readonly number[]): boolean {
  return order.length === ORDER_POINTS && slotCounts(order).every((n) => n === POINTS_PER_ABILITY);
}

/** Slot numbers → the hero's ability ids, in served `order`. Empty when fewer than four served. */
export function orderAbilityIds(order: readonly number[], abilityIds: readonly number[]): number[] {
  if (abilityIds.length < POINTS_PER_ABILITY) return [];
  return order.map((slot) => abilityIds[slot - 1] as number);
}

/** A valid order's served rate: exact match, else a served 14–16-long prefix. No match ⇒ no rate. */
export function matchOrderRate(
  order: readonly number[],
  abilityIds: readonly number[],
  orders: readonly AbilityOrder[] | undefined,
): OrderMatch | null {
  if (!orderIsValid(order)) return null;
  return matchOrderSequence(orderAbilityIds(order, abilityIds), orders);
}

//---- §12 compare boards A vs B

export type CompareUnit = 'flat' | 'percent' | 'souls';

export interface CompareRow {
  key: string;
  label: string;
  a: number;
  b: number;
  delta: number;
  unit: CompareUnit;
  //null on a tie; otherwise which board the delta favours.
  better: 'a' | 'b' | null;
}

//Weapon DPS and move speed are deliberately absent — see COMPARE_OMITTED.
const COMPARE_STATS: { key: string; label: string; unit: 'flat' | 'percent' }[] = [
  { key: 'max_health', label: 'Max health', unit: 'flat' },
  { key: 'bullet_resist', label: 'Bullet resist', unit: 'percent' },
  { key: 'spirit_resist', label: 'Spirit resist', unit: 'percent' },
  { key: 'weapon_damage', label: 'Weapon damage', unit: 'percent' },
  { key: 'spirit_power', label: 'Spirit power', unit: 'flat' },
];

export const COMPARE_OMITTED =
  'Weapon DPS and move speed are not compared: no served payload carries a weapon baseline (bullet damage, fire cycle, clip, reload), and no item modifier in this catalog routes to move speed.';

function lineValue(stats: ComputedStats, key: string): number {
  for (const cat of ['weapon', 'vitality', 'spirit'] as const) {
    const line = stats[cat].find((l) => l.key === key);
    if (line) return line.value;
  }
  return 0;
}

export function compareRows(a: ComputedStats, b: ComputedStats): CompareRow[] {
  const rows = COMPARE_STATS.map(({ key, label, unit }) => {
    const av = lineValue(a, key);
    const bv = lineValue(b, key);
    const delta = av - bv;
    return { key, label, a: av, b: bv, delta, unit: unit as CompareUnit, better: side(delta) };
  });
  //Board cost inverts: the cheaper board wins the row.
  const cost = a.spend.total - b.spend.total;
  rows.push({
    key: 'board_cost',
    label: 'Board cost',
    a: a.spend.total,
    b: b.spend.total,
    delta: cost,
    unit: 'souls',
    better: side(-cost),
  });
  return rows;
}

function side(delta: number): 'a' | 'b' | null {
  if (delta === 0) return null;
  return delta > 0 ? 'a' : 'b';
}

//---- §14 souls timeline

export const TIMELINE_MINUTES = 40;
export const TIMELINE_TICKS = [0, 10, 20, 30, 40];

export type TimelinePace = 'p25' | 'p50' | 'p75' | 'you';

export interface TimelineRow {
  pos: number;
  itemId: number;
  name: string;
  item: CatalogItem | undefined;
  cum: number;
  //seconds; null when the curve never reaches the running total (no extrapolation past the tail).
  slow: AffordableAt | null;
  fast: AffordableAt | null;
  at: AffordableAt | null;
}

/** Bar = the editorial slow…fast window; dot = a served percentile, or the player's own curve. */
export function timelineRows(
  rows: readonly PurchaseRow[],
  cohort: readonly CurvePointLike[],
  pace: TimelinePace,
  ownCurve: readonly CurvePointLike[],
): TimelineRow[] {
  return rows.map((row) => {
    const window = affordableWindow(cohort, row.running, 'p50');
    const at =
      pace === 'you'
        ? affordableAt(ownCurve, row.running, 'p50')
        : affordableAt(cohort, row.running, pace);
    return {
      pos: row.pos,
      itemId: row.itemId,
      name: row.name,
      item: row.item,
      cum: row.running,
      slow: window.slow,
      fast: window.fast,
      at,
    };
  });
}

/** Position on the 0–`TIMELINE_MINUTES` track, in percent; null past the end of the track. */
export function trackPercent(at: AffordableAt | null): number | null {
  if (at == null) return null;
  const share = at.tSeconds / (TIMELINE_MINUTES * 60);
  return share > 1 ? null : Math.max(0, share * 100);
}

/** The player's own economy curve read as a percentile-shaped curve the affordable-at reader eats. */
export function ownCurvePoints(points: readonly { t_seconds: number; value: number }[]): CurvePointLike[] {
  return points.map((p) => ({ t_seconds: p.t_seconds, p50: p.value }));
}

//The lane farm curve serves THOUSANDS of souls; item costs are in souls, so every percentile scales.
const SOULS_PER_UNIT = 1000;

export function cohortCurvePoints(points: readonly LaneCurvePoint[] | undefined): CurvePointLike[] {
  const scale = (v: number | null | undefined) => (typeof v === 'number' ? v * SOULS_PER_UNIT : null);
  return (points ?? [])
    .filter((p) => p.p50 != null)
    .map((p) => ({ t_seconds: p.t_seconds, p25: scale(p.p25), p50: scale(p.p50), p75: scale(p.p75) }));
}
