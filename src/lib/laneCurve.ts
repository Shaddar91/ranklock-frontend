//Pure per-minute transforms for the Lane Lab economy chart — kept out of the
//island component so the chart AND the unit tests transform a curve the SAME way.
//The backend serves cumulative p50 buckets 180s apart; the 'rate' view derives the
//per-minute amount gained across each bucket. No I/O — safe at build time and in tests.
import type { LaneCurveResponse, PlayerCurvePoint } from '../types/api';

//The chart's x-axis view: 'rate' = per-minute amount gained; 'total' = cumulative curve.
export type ViewMode = 'rate' | 'total';

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
  const pts = (curve?.points ?? [])
    .filter((p) => p.p50 != null)
    .slice()
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

//The picked player's own per-minute curve (getPlayerEconomyCurve `you`, already REAL units —
//no ×scale), transformed the same way: 'total' = the cumulative value, 'rate' = the souls /
//last-hits gained each minute. Same minute grid as laneSeriesByMinute.
export function playerSeriesByMinute(pts: PlayerCurvePoint[], mode: ViewMode): Map<number, number> {
  const sorted = pts.slice().sort((a, b) => a.t_seconds - b.t_seconds);
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
