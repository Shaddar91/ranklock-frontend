//Pure per-minute transforms for the Lane Lab economy chart — kept out of the
//island component so the chart AND the unit tests transform a curve the SAME way.
//The backend serves cumulative p50 buckets 180s apart; the 'rate' view derives the
//per-minute amount gained across each bucket. No I/O — safe at build time and in tests.
import type { LaneCurveResponse, PlayerCurvePoint, PlayerEconomyCurveResponse } from '../types/api';

//The chart's x-axis view: 'rate' = per-minute amount gained; 'total' = cumulative curve.
export type ViewMode = 'rate' | 'total';

//C5 (findings.md ranklock-fable-blindspots): the served lane/economy curves interleave dense
//~3M-sample buckets with ~1–7%-sample "straggler" minutes — an artifact of the 3-min
//match_player_timeline snapshot cadence — so roughly half the plotted points are statistical
//noise and BOTH the cumulative and per-minute views zigzag. Worse for 'rate': a delta taken
//across a ~4k-sample straggler subtracts a p50 measured on 4k players from one on 370k,
//producing a spurious per-minute spike at every dense→sparse transition. Fix: drop any bucket
//whose sample count is below MIN_SAMPLE_FRACTION of that curve's own peak, so every surviving
//point — and every 'rate' delta between two of them — rests on a dense (~3M-sample) bucket.
//Exported + tunable: raise toward 0.1 for a stricter curve, lower to admit more points.
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

//Convert a lane curve's p50 series into {game-minute → value}, honoring the view mode.
//'total' passes the cumulative p50 through (×scale). 'rate' returns the per-minute amount
//GAINED across each 180s bucket — (value[i] − value[i−1]) / minutesElapsed — a true
//souls/last-hits-per-minute rate (buckets are 3 min apart, so the delta is divided by 3).
//The first bucket has no predecessor, so it yields no rate point. Keyed by rounded game
//minute — the SAME grid playerSeriesByMinute uses, so the series overlay cleanly.
export function laneSeriesByMinute(
  curve: LaneCurveResponse | undefined,
  scale: number,
  mode: ViewMode,
): Map<number, number> {
  //Drop sub-5%-of-peak straggler buckets FIRST (C5), so the rate delta is only ever taken
  //between two dense buckets; then discard null-p50 gaps and sort onto the minute grid.
  const pts = dropLowSamplePoints(curve?.points ?? [], (p) => p.sample_players)
    .filter((p) => p.p50 != null)
    .sort((a, b) => a.t_seconds - b.t_seconds);
  const out = new Map<number, number>();
  pts.forEach((p, i) => {
    const min = Math.round(p.t_seconds / 60);
    const val = (p.p50 as number) * scale;
    if (mode === 'total') {
      out.set(min, val);
      return;
    }
    const prev = pts[i - 1];
    if (!prev) return; //no prior bucket → no per-minute delta for the first point
    const minutes = (p.t_seconds - prev.t_seconds) / 60;
    if (minutes > 0) out.set(min, (val - (prev.p50 as number) * scale) / minutes);
  });
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

//The picked player's own per-minute curve (getPlayerEconomyCurve `you`, already REAL units —
//no ×scale), transformed the same way: 'total' = the cumulative value, 'rate' = the souls /
//last-hits gained each minute. Same minute grid as laneSeriesByMinute.
export function playerSeriesByMinute(pts: PlayerCurvePoint[], mode: ViewMode): Map<number, number> {
  //Same low-sample guard as the rank lines (C5), keyed on the player's per-minute match
  //count, so the personal 'rate' delta is never computed across a near-empty minute.
  const sorted = dropLowSamplePoints(pts, (p) => p.matches).sort((a, b) => a.t_seconds - b.t_seconds);
  const out = new Map<number, number>();
  sorted.forEach((p, i) => {
    const min = Math.round(p.t_seconds / 60);
    if (mode === 'total') {
      out.set(min, p.value);
      return;
    }
    const prev = sorted[i - 1];
    if (!prev) return;
    const minutes = (p.t_seconds - prev.t_seconds) / 60;
    if (minutes > 0) out.set(min, (p.value - prev.value) / minutes);
  });
  return out;
}
