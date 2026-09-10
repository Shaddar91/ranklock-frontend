//Pure per-minute transforms for the Lane Lab economy chart — kept out of the island component so
//the chart AND the unit tests transform a curve the SAME way. The backend serves cumulative
import type { PlayerCurvePoint, PlayerEconomyCurveResponse, RankCohort } from '../types/api';

export type ViewMode = 'rate' | 'total';

export const MIN_SAMPLE_FRACTION = 0.05;

export function dropLowSamplePoints<T>(pts: readonly T[], sampleOf: (p: T) => number): T[] {
  let peak = 0;
  for (const p of pts) {
    const n = sampleOf(p) ?? 0;
    if (n > peak) peak = n;
  }
  const floor = MIN_SAMPLE_FRACTION * peak;
  return pts.filter((p) => (sampleOf(p) ?? 0) >= floor);
}

//The game-start value each cumulative metric has at 0:00 — souls start at the 600-soul game
//constant, every other metric at 0. A rule of the game, not a measurement: used ONLY as the
//predecessor of the 3:00 bucket in 'rate' mode and never plotted as a point.
export const SOULS_AT_ZERO = 600;
export function originValue(metric: string): number {
  return metric === 'souls' ? SOULS_AT_ZERO : 0;
}
//The first real grid instant (3:00). Only a point HERE may anchor its rate on the 0:00 origin; a
//first surviving point anywhere later has an unknown predecessor and yields no rate.
const FIRST_GRID_T = 180;

//Per-minute gain between consecutive surviving points: (value − previous) / minutes elapsed. Shared
//by the league and player lines so the two 'rate' series can never disagree on the origin rule.
function ratePoints<P>(
  sorted: readonly P[],
  tOf: (p: P) => number,
  vOf: (p: P) => number,
  metric: string,
): Map<number, number> {
  const out = new Map<number, number>();
  sorted.forEach((p, i) => {
    const t = tOf(p);
    const prev = sorted[i - 1];
    let prevT: number;
    let prevVal: number;
    if (prev) {
      prevT = tOf(prev);
      prevVal = vOf(prev);
    } else if (t === FIRST_GRID_T) {
      prevT = 0;
      prevVal = originValue(metric);
    } else {
      return;
    }
    const minutes = (t - prevT) / 60;
    if (minutes > 0) out.set(Math.round(t / 60), (vOf(p) - prevVal) / minutes);
  });
  return out;
}

export interface PercentileCurveLike {
  points: ReadonlyArray<{
    t_seconds: number;
    p25?: number | null;
    p50: number | null;
    p75?: number | null;
    sample_players: number;
  }>;
}

//Convert a lane curve's p50 series into {game-minute → value}, honoring the view mode.
export function laneSeriesByMinute(
  curve: PercentileCurveLike | null | undefined,
  scale: number,
  mode: ViewMode,
  metric: string,
): Map<number, number> {
  //Drop the tail-guard buckets FIRST, then discard null-p50 gaps and sort onto the minute grid.
  const pts = dropLowSamplePoints(curve?.points ?? [], (p) => p.sample_players)
    .filter((p) => p.p50 != null)
    .sort((a, b) => a.t_seconds - b.t_seconds);
  if (mode === 'total') {
    const out = new Map<number, number>();
    for (const p of pts) out.set(Math.round(p.t_seconds / 60), (p.p50 as number) * scale);
    return out;
  }
  return ratePoints(
    pts,
    (p) => p.t_seconds,
    (p) => (p.p50 as number) * scale,
    metric,
  );
}

//The league's middle half — [p25, p75] per game minute, real units (×scale) — for the cumulative
//view only: a spread of cumulative values is a band; per-minute rates of quantiles are not. Same
//tail guard; a minute missing either quantile has no band there.
export function laneBandByMinute(
  curve: PercentileCurveLike | null | undefined,
  scale: number,
): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  for (const p of dropLowSamplePoints(curve?.points ?? [], (p) => p.sample_players)) {
    if (p.p25 == null || p.p75 == null) continue;
    out.set(Math.round(p.t_seconds / 60), [p.p25 * scale, p.p75 * scale]);
  }
  return out;
}

export function guardedPlayerCurvePoints(
  resp: Pick<PlayerEconomyCurveResponse, 'metric' | 'you'> | undefined,
  requestedMetric: string,
): PlayerCurvePoint[] {
  if (!resp || resp.metric !== requestedMetric) return [];
  return resp.you ?? [];
}


//Below this many games at the line's best-sampled minute, the line is rendered faint with a
//"thin sample" note — a 1–4-game curve is an anecdote, not a trend.
export const THIN_SAMPLE_MIN_MATCHES = 5;

//Peak per-bucket `matches` across the player's curve — the n the caption discloses ("n = X
//games"). Peak (not min) because `matches` decays along the x-axis as shorter games drop
//out; the peak is how many games the line actually rests on. 0 for an empty/absent curve.
export function peakPlayerMatches(pts: readonly PlayerCurvePoint[] | undefined): number {
  return (pts ?? []).reduce((m, p) => Math.max(m, p.matches ?? 0), 0);
}

export function isThinPlayerSample(peak: number): boolean {
  return peak < THIN_SAMPLE_MIN_MATCHES;
}

//---- the composable comparison-set merge -------------------------------------
//The chart's four fixed series slots (EconomyCurve dataKeys). Which ENTITY each slot
//carries is the caller's selection state — the slot names are internal only; every
//user-visible label comes from the selection (league name / player name + hero).
export type EconSeriesKey = 'you' | 'cohort' | 'player' | 'player2';
//The two league slots may also carry their p25–p75 band (cumulative view).
export type EconBandKey = 'you' | 'cohort';

export interface MergedEconPoint {
  //match minute
  min: number;
  you?: number;
  cohort?: number;
  player?: number;
  player2?: number;
  //[p25, p75] of the league in that slot at this minute — present only where the band map has it.
  youBand?: [number, number];
  cohortBand?: [number, number];
}

export function mergeEconSeriesByMinute(
  series: Partial<Record<EconSeriesKey, Map<number, number> | null>>,
  bands?: Partial<Record<EconBandKey, Map<number, [number, number]> | null>>,
): MergedEconPoint[] {
  const live = (Object.entries(series) as [EconSeriesKey, Map<number, number> | null | undefined][])
    .filter((e): e is [EconSeriesKey, Map<number, number>] => e[1] != null && e[1].size > 0);
  const minutes = new Set<number>();
  for (const [, m] of live) for (const min of m.keys()) minutes.add(min);
  return [...minutes]
    .sort((a, b) => a - b)
    .map((min) => {
      const p: MergedEconPoint = { min };
      for (const [key, m] of live) p[key] = m.get(min) ?? NaN;
      const youBand = bands?.you?.get(min);
      if (youBand) p.youBand = youBand;
      const cohortBand = bands?.cohort?.get(min);
      if (cohortBand) p.cohortBand = cohortBand;
      return p;
    });
}

//The picked player's own per-minute curve (getPlayerEconomyCurve `you`, already REAL units —
//no ×scale), transformed the same way: 'total' = the cumulative value, 'rate' = the souls /
//last-hits gained each minute (same origin rule as the league lines). Same minute grid.
export function playerSeriesByMinute(
  pts: PlayerCurvePoint[],
  mode: ViewMode,
  metric: string,
): Map<number, number> {
  //Same tail guard as the league lines, keyed on the player's per-minute match count, so the
  //personal 'rate' delta is never computed across a near-empty minute.
  const sorted = dropLowSamplePoints(pts, (p) => p.matches).sort((a, b) => a.t_seconds - b.t_seconds);
  if (mode === 'total') {
    const out = new Map<number, number>();
    for (const p of sorted) out.set(Math.round(p.t_seconds / 60), p.value);
    return out;
  }
  return ratePoints(
    sorted,
    (p) => p.t_seconds,
    (p) => p.value,
    metric,
  );
}

//---- per-player rank cohort selection (DESIGN §8, migration 052) ------------
export interface CohortParams {
  band?: number;
  tier?: number;
  division?: number;
}

export function cohortParamsFor(
  cohort: RankCohort,
  tierOrBand: number | undefined,
  division: number | undefined,
): CohortParams | null {
  if (cohort === 'team_average') return { band: tierOrBand };
  if (tierOrBand == null || tierOrBand < 1) return null;
  return { tier: tierOrBand, division };
}

//The SAME cohort selection under /players/:id/economy-curve's names: that endpoint calls the
//team-average league `vs_band`, and serde DROPS an unknown `band` rather than 400ing — so the
//wrong name silently returns the ALL-bands hero cohort under the selected league's caption.
export interface PlayerCurveCohortParams {
  vs_band?: number;
  tier?: number;
  division?: number;
}

export function playerCurveParamsFor(
  cohort: RankCohort,
  tierOrBand: number | undefined,
  division: number | undefined,
): PlayerCurveCohortParams | null {
  const p = cohortParamsFor(cohort, tierOrBand, division);
  if (p == null) return null;
  return cohort === 'team_average' ? { vs_band: p.band } : { tier: p.tier, division: p.division };
}

export const RANK_MIN_SAMPLE = 500;
export function isThinRankSample(cohort: RankCohort, peakSamplePlayers: number): boolean {
  return cohort === 'player_rank' && peakSamplePlayers > 0 && peakSamplePlayers < RANK_MIN_SAMPLE;
}

export type CohortProbeState = 'pending' | 'rows' | 'empty' | 'error';
export function defaultCohortFromProbe(state: CohortProbeState): RankCohort | null {
  if (state === 'rows') return 'player_rank';
  if (state === 'empty' || state === 'error') return 'team_average';
  return null;
}
