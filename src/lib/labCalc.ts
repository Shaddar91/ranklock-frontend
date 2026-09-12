//Build Lab theoretical calculators: affordable-at over the served economy curve, abilities with
//the build, time-to-kill, burst, effective HP, their-TTK. Every output here is a MODEL, so each
//one carries its range and its label set — a caller cannot render one of these bare (brief §5).
import { MAX_LEVEL, clampLevel } from './computeStats';

export const THEORETICAL_NOTE =
  'Theoretical: no ability resists, no damage falloff, no missed shots; weapon DPS at 0–25 m.';

export type AssumptionKey =
  | 'spirit-scaling'
  | 'spirit-scaling-missing'
  | 'resists-multiplicative'
  | 'enemy-dps-band'
  | 'channel-window'
  | 'pace-factors';

export const ASSUMPTIONS: Record<AssumptionKey, string> = {
  'spirit-scaling': "Spirit scaling uses upstream's factor in an assumed base + spirit × scale shape.",
  'spirit-scaling-missing': 'This ability serves no spirit-scaling factor — the figure excludes your spirit power.',
  'resists-multiplicative': 'Resists are assumed to stack multiplicatively.',
  'enemy-dps-band': 'The ±12 % enemy-DPS band is editorial, not measured.',
  'channel-window': 'The channelled part is shown over a 1.00–1.25× window (editorial).',
  'pace-factors': 'The slow / fast pace window (×1.2 / ×0.85) is editorial, not measured.',
};

export interface Ranged {
  lo: number;
  hi: number;
  note: string;
  assumed: AssumptionKey[];
}

function ranged(a: number, b: number, assumed: AssumptionKey[] = []): Ranged {
  return { lo: Math.min(a, b), hi: Math.max(a, b), note: THEORETICAL_NOTE, assumed };
}

function positive(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v) && v > 0);
}

//---- affordable-at over the served economy curve -----------------------------

export type CurvePercentile = 'p25' | 'p50' | 'p75';

export interface CurvePointLike {
  t_seconds: number;
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
}

export interface AffordableAt {
  tSeconds: number;
  percentile: CurvePercentile;
  //false when the cost lands exactly on a served point, or before the first one.
  interpolated: boolean;
}

/**
 * First instant the percentile's cumulative souls reach `cost`, linearly interpolated between the
 * two bracketing points. null when the curve never reaches it — no extrapolation past the tail.
 */
export function affordableAt(
  points: readonly CurvePointLike[],
  cost: number,
  percentile: CurvePercentile = 'p50',
): AffordableAt | null {
  const pts = points
    .filter((p) => typeof p[percentile] === 'number' && Number.isFinite(p.t_seconds))
    .map((p) => ({ t: p.t_seconds, v: p[percentile] as number }))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0) return null;
  if (cost <= 0) return { tSeconds: 0, percentile, interpolated: false };

  for (let i = 0; i < pts.length; i += 1) {
    const here = pts[i]!;
    if (here.v < cost) continue;
    const prev = pts[i - 1];
    if (!prev || prev.v >= cost || here.v === prev.v) {
      return { tSeconds: here.t, percentile, interpolated: false };
    }
    const share = (cost - prev.v) / (here.v - prev.v);
    return { tSeconds: prev.t + share * (here.t - prev.t), percentile, interpolated: here.v !== cost };
  }
  return null;
}

//The design's slow / fast pace window — editorial factors on the cost, never a served spread.
export const PACE_SLOW = 1.2;
export const PACE_FAST = 0.85;

export interface AffordableWindow {
  mid: AffordableAt | null;
  slow: AffordableAt | null;
  fast: AffordableAt | null;
  assumed: AssumptionKey[];
}

export function affordableWindow(
  points: readonly CurvePointLike[],
  cost: number,
  percentile: CurvePercentile = 'p50',
): AffordableWindow {
  return {
    mid: affordableAt(points, cost, percentile),
    slow: affordableAt(points, cost * PACE_SLOW, percentile),
    fast: affordableAt(points, cost * PACE_FAST, percentile),
    assumed: ['pace-factors'],
  };
}

/** Running total after each purchase — the souls-timeline x-input. */
export function cumulativeCosts(costs: readonly number[]): number[] {
  let running = 0;
  return costs.map((c) => (running += c ?? 0));
}

//---- abilities with the build ------------------------------------------------

//Upstream tags a scaling row with the stat it reads; only ETechPower rows carrying a numeric
//`scale` give a spirit factor — every other row scales off something this calculator does not model.
export const SPIRIT_SCALE_STAT = 'ETechPower';

export function spiritScaleOf(
  scaling: { stat?: string; scale?: number } | null | undefined,
): number | null {
  if (scaling?.stat !== SPIRIT_SCALE_STAT) return null;
  return typeof scaling.scale === 'number' && Number.isFinite(scaling.scale) ? scaling.scale : null;
}

export interface AbilityBaseline {
  abilityId: number;
  name: string;
  damage?: number | null;
  //damage per point of spirit power (`spiritScaleOf`); null ⇒ upstream serves none, and the
  //damage figure then EXCLUDES spirit rather than inventing a factor.
  spiritScaling?: number | null;
  cooldown?: number | null;
  duration?: number | null;
  range?: number | null;
}

export interface BuildModifiers {
  spiritPower: number;
  //each entry a 0..1 fraction of its own; they compound, they never sum.
  cdr: number[];
  durationPct: number;
  rangePct: number;
}

export interface AbilityValue {
  base: number;
  value: number;
}
export interface AbilityWithBuild {
  abilityId: number;
  name: string;
  damage: (AbilityValue & { fromSpirit: number }) | null;
  cooldown: AbilityValue | null;
  duration: AbilityValue | null;
  range: AbilityValue | null;
  note: string;
  assumed: AssumptionKey[];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

/** Combined reduction of independently-stacking CDR sources: 1 − Π(1 − rᵢ). */
export function multiplicativeCdr(fractions: readonly number[]): number {
  return 1 - fractions.reduce((acc, f) => acc * (1 - clamp01(f)), 1);
}

export function abilityWithBuild(ability: AbilityBaseline, mods: BuildModifiers): AbilityWithBuild {
  const assumed: AssumptionKey[] = [];
  const scaling = ability.spiritScaling ?? null;
  const damageBase = ability.damage ?? null;
  if (damageBase != null && mods.spiritPower !== 0) {
    assumed.push(scaling == null ? 'spirit-scaling-missing' : 'spirit-scaling');
  }
  const fromSpirit = scaling == null ? 0 : scaling * mods.spiritPower;
  const retained = 1 - multiplicativeCdr(mods.cdr);

  return {
    abilityId: ability.abilityId,
    name: ability.name,
    damage: damageBase == null ? null : { base: damageBase, value: damageBase + fromSpirit, fromSpirit },
    cooldown: ability.cooldown == null ? null : { base: ability.cooldown, value: ability.cooldown * retained },
    duration:
      ability.duration == null
        ? null
        : { base: ability.duration, value: ability.duration * (1 + mods.durationPct / 100) },
    range:
      ability.range == null ? null : { base: ability.range, value: ability.range * (1 + mods.rangePct / 100) },
    note: THEORETICAL_NOTE,
    assumed,
  };
}

export function abilitiesWithBuild(
  abilities: readonly AbilityBaseline[],
  mods: BuildModifiers,
): AbilityWithBuild[] {
  return abilities.map((a) => abilityWithBuild(a, mods));
}

//---- target, time to kill, burst --------------------------------------------

/** A target's health at a level: the hero's base plus its per-level growth. */
export function targetHp(baseHp: number, perLevel: number, level: number): number {
  return baseHp + perLevel * (clampLevel(level) - 1);
}

export const LAB_LEVELS = [12, 20, 28] as const;
export { MAX_LEVEL };

export function timeToKill(hp: number, dpsLo: number, dpsHi: number): Ranged | null {
  if (!positive(hp, dpsLo, dpsHi)) return null;
  return ranged(hp / dpsHi, hp / dpsLo);
}

export const CHANNEL_MAX = 1.25;

export interface BurstPart {
  damage: number;
  spiritScaling?: number | null;
  //a channelled part only lands in full if the channel completes — the high bound of the window.
  channelled?: boolean;
}

export function burstDamage(parts: readonly BurstPart[], spiritPower: number): Ranged | null {
  if (parts.length === 0) return null;
  const assumed: AssumptionKey[] = [];
  let lo = 0;
  let hi = 0;
  for (const part of parts) {
    const scaling = part.spiritScaling ?? null;
    if (spiritPower !== 0) assumed.push(scaling == null ? 'spirit-scaling-missing' : 'spirit-scaling');
    const value = part.damage + (scaling == null ? 0 : scaling * spiritPower);
    lo += value;
    hi += part.channelled ? value * CHANNEL_MAX : value;
    if (part.channelled) assumed.push('channel-window');
  }
  return ranged(lo, hi, [...new Set(assumed)]);
}

//---- effective HP and their time to kill you --------------------------------

export interface EffectiveHp {
  hp: number;
  ehp: number;
  //the stacked resist as a 0..1 fraction: 1 − Π(1 − rᵢ).
  combinedResist: number;
  note: string;
  assumed: AssumptionKey[];
}

/** Resists arrive as the panels' percent lines (30 = 30 %); they compound, they never sum. */
export function effectiveHp(hp: number, resistPercents: readonly number[]): EffectiveHp | null {
  if (!positive(hp)) return null;
  const taken = resistPercents.reduce((acc, r) => acc * (1 - (Number.isFinite(r) ? r : 0) / 100), 1);
  if (!(taken > 0)) return null;
  return {
    hp,
    ehp: hp / taken,
    combinedResist: 1 - taken,
    note: THEORETICAL_NOTE,
    assumed: ['resists-multiplicative'],
  };
}

export interface EffectiveHpPair {
  vsBullets: EffectiveHp | null;
  vsSpirit: EffectiveHp | null;
}

export function effectiveHpPair(
  hp: number,
  bulletResistPercents: readonly number[],
  spiritResistPercents: readonly number[],
): EffectiveHpPair {
  return {
    vsBullets: effectiveHp(hp, bulletResistPercents),
    vsSpirit: effectiveHp(hp, spiritResistPercents),
  };
}

export const ENEMY_DPS_BAND = 0.12;

export function theirTimeToKill(ehp: number, dps: number): Ranged | null {
  if (!positive(ehp, dps)) return null;
  return ranged(ehp / (dps * (1 + ENEMY_DPS_BAND)), ehp / (dps * (1 - ENEMY_DPS_BAND)), ['enemy-dps-band']);
}
