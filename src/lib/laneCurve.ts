//Pure per-minute transforms for the Lane Lab economy chart — kept out of the island component so
//the chart AND the unit tests transform a curve the SAME way. The backend serves cumulative
//p25/p50/p75 buckets 180s apart (grid-resampled: one value per surviving player-match per bucket);
//the 'rate' view derives the per-minute amount gained across each bucket. No I/O — safe at build
//time and in tests.
import type { PlayerCurvePoint, PlayerEconomyCurveResponse, RankCohort } from '../types/api';

export type ViewMode = 'rate' | 'total';

//Tail guard: a bucket resting on fewer than this fraction of the curve's peak sample count is a
//handful of very long games, not the cohort — drop it so a 24-sample 165-minute bucket never draws
//next to a 50M-sample one, and no 'rate' delta is ever taken against it. The producers resample
//every player-match onto the grid, so no in-game bucket is starved any more; this only trims the
//far tail. Exported + tunable.
export const MIN_SAMPLE_FRACTION = 0.05;

//Drop the low-confidence straggler points (C5): keep only points whose sample count is at
//least MIN_SAMPLE_FRACTION of the curve's peak sample count. `sampleOf` reads the per-series
//sample field — lane/rank rows carry `sample_players`, the player's own line carries `matches`
//(how many of their games reached that minute). A peak of 0 (empty, or all-zero samples) keeps
//every point: nothing is below 0, so there is no division and no accidental wipe of a
//thin-but-uniformly-sampled curve. Pure and side-effect-free — returns a new array.
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

//The structural shape of a percentile league curve — BOTH the lane endpoints'
//LaneCurveResponse AND the player-curve endpoint's `comparison` side (PlayerCurveComparison)
//satisfy it, so one transform serves the fast Gold league curves (bucket units — pass the
//metric's bucket scale) and the hero-scoped league curves (already real units — pass scale 1).
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
//'total' passes the cumulative p50 through (×scale). 'rate' returns the per-minute amount GAINED
//across each 180s bucket (ratePoints — the 3:00 bucket anchors on the metric's 0:00 origin).
//Keyed by rounded game minute — the SAME grid playerSeriesByMinute uses, so the series overlay.
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

//M1/B1(b): the metric-echo mismatch guard. The player-curve payload echoes which metric it
//actually carries (`metric`); a payload whose echo ≠ the metric the UI requested is a
//WRONG-UNIT line (e.g. souls plotted on the kills tab) and must be unrenderable regardless
//of backend version. Mismatch — or a missing/absent echo, which is unverifiable — yields the
//empty array, the same shape as "no timeline loaded", so callers fall into the existing
//honest empty-state instead of plotting a mislabeled line. Pure; safe in tests.
export function guardedPlayerCurvePoints(
  resp: Pick<PlayerEconomyCurveResponse, 'metric' | 'you'> | undefined,
  requestedMetric: string,
): PlayerCurvePoint[] {
  if (!resp || resp.metric !== requestedMetric) return [];
  return resp.you ?? [];
}

//Sample-size disclosure for the player lines (Component 11 / B6): a player line is drawn
//from as few as 1 of their games while the rank band behind it aggregates millions, so the
//caption must carry the line's own n and a thin line must LOOK thin.

//Below this many games at the line's best-sampled minute, the line is rendered faint with a
//"thin sample" note — a 1–4-game curve is an anecdote, not a trend.
export const THIN_SAMPLE_MIN_MATCHES = 5;

//Peak per-bucket `matches` across the player's curve — the n the caption discloses ("n = X
//games"). Peak (not min) because `matches` decays along the x-axis as shorter games drop
//out; the peak is how many games the line actually rests on. 0 for an empty/absent curve.
export function peakPlayerMatches(pts: readonly PlayerCurvePoint[] | undefined): number {
  return (pts ?? []).reduce((m, p) => Math.max(m, p.matches ?? 0), 0);
}

//The thin-sample predicate: fewer than THIN_SAMPLE_MIN_MATCHES games at peak.
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

//Merge any subset of per-minute series onto ONE union minute grid — one point per game
//minute present in ANY provided series. A series with no sample at a minute gets NaN there
//(Recharts renders a gap, never a fabricated point). Pass null/undefined (or an empty map)
//to omit a series entirely — its key never appears, so the chart draws no line for it.
//Unlike the old fixed you-grid merge, no series is the "base": unchecking the League A chip
//must not collapse the grid the other series render on. Bands attach to minutes the grid
//already has — they never add a minute of their own.
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
//One league slot's resolved query params for the active cohort. EXACTLY one of {band} /
//{tier[,division]} is ever returned — curves.rs 400s a request carrying both — so this is the
//single place that decides which, shared by the lane-Gold fetch and the hero-scoped comparison
//fetch (both take the same three params).
export interface CohortParams {
  band?: number;
  tier?: number;
  division?: number;
}

//null = no valid selection to query (player-rank mode with the league selector sitting on
//Obscurus or "All" — neither has a per-player-rank cohort). Callers must gate their query's
//`enabled` on a non-null result instead of sending an empty request, which the backend would
//silently resolve to the ALL-BANDS team-average cohort (DESIGN's "never blend the two cohort
//definitions" rule).
export function cohortParamsFor(
  cohort: RankCohort,
  tierOrBand: number | undefined,
  division: number | undefined,
): CohortParams | null {
  if (cohort === 'team_average') return { band: tierOrBand };
  if (tierOrBand == null || tierOrBand < 1) return null;
  return { tier: tierOrBand, division };
}

//Thin per-player-rank cells (DESIGN §9 / Failure cases): a division of a low-population tier
//(Eternus ≈ 200 rows/division/week) can return real but too-few rows to trust — the UI must not
//draw them, only name the floor. team_average never gates on this (its samples are large).
export const RANK_MIN_SAMPLE = 500;
export function isThinRankSample(cohort: RankCohort, peakSamplePlayers: number): boolean {
  return cohort === 'player_rank' && peakSamplePlayers > 0 && peakSamplePlayers < RANK_MIN_SAMPLE;
}

//The cohort switch's smart default (DESIGN §9): "player rank" when a probe query against the
//current league actually has rows, else "team average" — captioned either way once resolved.
//'pending' keeps whatever the switch already shows; the caller applies this only until the user
//touches the switch themselves, after which their explicit pick stands.
export type CohortProbeState = 'pending' | 'rows' | 'empty' | 'error';
export function defaultCohortFromProbe(state: CohortProbeState): RankCohort | null {
  if (state === 'rows') return 'player_rank';
  if (state === 'empty' || state === 'error') return 'team_average';
  return null;
}
