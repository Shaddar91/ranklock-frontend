//Pure transforms for THE signature economy curve (/players/:id) — kept out of the
//component so the panel AND any snapshot/screenshot harness merge the endpoint the SAME
//way. The backend returns two independent per-minute series (`you` = your fixed curve;
//`comparison.points` = the selected cohort's p25/p50/p75); recharts wants ONE array keyed
//by the x value, so we union them by game minute.
import type { PlayerEconomyCurveResponse } from '../types/api';
import type { SignaturePoint, SignatureDeltaPoint } from '../components/react/charts/SignatureCurve';

//Game minute for a per-minute point. The backend buckets are 3-min wide (t_seconds =
//minute_bucket * 180), so t_seconds/60 is the real match minute (3, 6, 9, …).
const minuteOf = (t_seconds: number): number => Math.round(t_seconds / 60);

//Union the fixed `you` series and the `comparison` cohort into the recharts point shape,
//keyed + sorted by game minute. A missing side is simply left off that datum (recharts
//`connectNulls` bridges the gap) — the two series never have to share a minute grid.
export function mergeSignatureCurve(resp: PlayerEconomyCurveResponse | undefined): SignaturePoint[] {
  if (!resp) return [];
  const byMin = new Map<number, SignaturePoint>();
  const at = (min: number): SignaturePoint => byMin.get(min) ?? { min };

  for (const p of resp.you ?? []) {
    const min = minuteOf(p.t_seconds);
    byMin.set(min, { ...at(min), min, you: p.value });
  }
  for (const p of resp.comparison?.points ?? []) {
    const min = minuteOf(p.t_seconds);
    byMin.set(min, {
      ...at(min),
      min,
      cmp: p.p50 ?? undefined,
      band: p.p25 != null && p.p75 != null ? [p.p25, p.p75] : undefined,
    });
  }
  return [...byMin.values()].sort((a, b) => a.min - b.min);
}

//The representative "you vs cohort" reading for the caption — the point nearest `targetMin`
//where BOTH series exist. Returns null when the two curves never overlap (e.g. no cohort).
//`gap` is you − cohort-median: positive = ahead of the cohort, negative = behind.
export function curveMarker(
  points: SignaturePoint[],
  targetMin = 10,
): { min: number; you: number; cmp: number; gap: number } | null {
  let best: { min: number; you: number; cmp: number; gap: number } | null = null;
  for (const p of points) {
    if (p.you == null || p.cmp == null) continue;
    if (best == null || Math.abs(p.min - targetMin) < Math.abs(best.min - targetMin)) {
      best = { min: p.min, you: p.you, cmp: p.cmp, gap: p.you - p.cmp };
    }
  }
  return best;
}

//The Gap ("delta") series: for every minute where BOTH your curve and the cohort median
//exist, the signed distance you − cohort-p50 and the cohort's own p25–p75 spread re-centred
//on that median (so the band straddles zero). Points missing either side are dropped — the
//gap is undefined without a cohort (mirrors curveMarker's both-series rule).
export function signatureDelta(points: SignaturePoint[]): SignatureDeltaPoint[] {
  const out: SignatureDeltaPoint[] = [];
  for (const p of points) {
    if (p.you == null || p.cmp == null) continue;
    out.push({
      min: p.min,
      delta: p.you - p.cmp,
      deltaBand: p.band ? [p.band[0] - p.cmp, p.band[1] - p.cmp] : undefined,
    });
  }
  return out;
}
