import { describe, it, expect } from 'vitest';
import {
  MIN_SAMPLE_FRACTION,
  dropLowSamplePoints,
  laneSeriesByMinute,
  playerSeriesByMinute,
} from './laneCurve';
import type { LaneCurvePoint, LaneCurveResponse, PlayerCurvePoint } from '../types/api';

//The lane curve buckets are 180s apart; souls are encoded as net_worth/1000 so the
//chart passes scale=1000 to recover real souls. 'total' = cumulative p50*scale;
//'rate' = per-minute amount gained across each 3-minute bucket, first bucket omitted.
//sample_players defaults to a uniform 50 so the existing tests are unaffected by the C5
//low-sample filter (uniform curve → nothing below 5% of peak); pass a third arg to model a
//straggler minute.
const lanePt = (t_seconds: number, p50: number | null, sample_players = 50): LaneCurvePoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  sample_players,
  p25: null,
  p50,
  p75: null,
});
const laneCurve = (points: LaneCurvePoint[]): LaneCurveResponse => ({ band: 2, metric: 'souls', points });
//matches (the player-line sample analog) defaults to a uniform 5 for the same reason.
const playerPt = (t_seconds: number, value: number, matches = 5): PlayerCurvePoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  value,
  matches,
});

describe('laneSeriesByMinute', () => {
  const curve = laneCurve([lanePt(180, 1), lanePt(360, 3), lanePt(540, 6)]);

  it('total mode maps each game minute to p50 * scale', () => {
    const out = laneSeriesByMinute(curve, 1000, 'total');
    expect(out.get(3)).toBe(1000);
    expect(out.get(6)).toBe(3000);
    expect(out.get(9)).toBe(6000);
    expect(out.size).toBe(3);
  });

  it('rate mode yields the per-minute delta and omits the first bucket', () => {
    const out = laneSeriesByMinute(curve, 1000, 'rate');
    expect(out.has(3)).toBe(false); //no predecessor → no rate point
    expect(out.get(6)).toBeCloseTo(2000 / 3, 6); //(3000-1000)/3 min ≈ 666.67 souls/min
    expect(out.get(9)).toBe(1000); //(6000-3000)/3
    expect(out.size).toBe(2);
  });

  it('filters out null-p50 buckets before computing the delta', () => {
    const withGap = laneCurve([lanePt(180, 1), lanePt(360, null), lanePt(540, 6)]);
    const total = laneSeriesByMinute(withGap, 1000, 'total');
    expect(total.has(6)).toBe(false);
    expect(total.size).toBe(2);
    //min 9's predecessor is the surviving min-3 bucket: (6000-1000)/6 min ≈ 833.33.
    const rate = laneSeriesByMinute(withGap, 1000, 'rate');
    expect(rate.get(9)).toBeCloseTo(5000 / 6, 6);
  });

  it('sorts unsorted input by t_seconds before keying', () => {
    const unsorted = laneCurve([lanePt(540, 6), lanePt(180, 1), lanePt(360, 3)]);
    expect([...laneSeriesByMinute(unsorted, 1, 'total').keys()]).toEqual([3, 6, 9]);
  });

  it('returns an empty map for an undefined curve', () => {
    expect(laneSeriesByMinute(undefined, 1000, 'total').size).toBe(0);
  });
});

describe('playerSeriesByMinute', () => {
  const pts = [playerPt(180, 1000), playerPt(360, 2500), playerPt(540, 4000)];

  it('total mode passes the real value straight through (no scale)', () => {
    const out = playerSeriesByMinute(pts, 'total');
    expect(out.get(3)).toBe(1000);
    expect(out.get(6)).toBe(2500);
    expect(out.get(9)).toBe(4000);
  });

  it('rate mode yields per-minute gain and omits the first bucket', () => {
    const out = playerSeriesByMinute(pts, 'rate');
    expect(out.has(3)).toBe(false);
    expect(out.get(6)).toBeCloseTo(500, 6); //(2500-1000)/3
    expect(out.get(9)).toBeCloseTo(500, 6); //(4000-2500)/3
    expect(out.size).toBe(2);
  });

  it('sorts unsorted input by t_seconds', () => {
    const unsorted = [playerPt(360, 2500), playerPt(180, 1000)];
    expect([...playerSeriesByMinute(unsorted, 'total').keys()]).toEqual([3, 6]);
  });

  it('returns an empty map for no points', () => {
    expect(playerSeriesByMinute([], 'total').size).toBe(0);
  });
});

describe('C5 low-sample-point filter', () => {
  //The live band-6 souls curve oscillates min6≈370k, min7≈4k (straggler), min8≈368k as the
  //3-min match_player_timeline cadence leaves the in-between minute near-empty. The 4k point
  //is ~1% of the 370k peak, well under the 5% floor, so it must be dropped before the series
  //is built — otherwise the 'rate' delta subtracts a 4k-sample p50 from a 370k-sample one.
  const series = laneCurve([
    lanePt(360, 5, 370000), //min 6 — dense
    lanePt(420, 6, 4000), //min 7 — straggler (~1% of peak) → must drop
    lanePt(480, 7, 368000), //min 8 — dense
  ]);

  it('MIN_SAMPLE_FRACTION is the exported, tunable 5%-of-peak default', () => {
    expect(MIN_SAMPLE_FRACTION).toBe(0.05);
  });

  it('drops the sub-5%-of-peak straggler minute from the total series', () => {
    const total = laneSeriesByMinute(series, 1000, 'total');
    expect(total.has(7)).toBe(false); //the 4k-sample straggler is gone
    expect([...total.keys()]).toEqual([6, 8]); //only the two dense minutes survive
    //and no surviving point rests on a sub-threshold sample count
    expect(total.get(6)).toBe(5000);
    expect(total.get(8)).toBe(7000);
  });

  it('computes the rate delta between the two DENSE points, never across the straggler', () => {
    const rate = laneSeriesByMinute(series, 1000, 'rate');
    expect(rate.has(7)).toBe(false);
    //min 8's predecessor is now the surviving min-6 dense point: (7000-5000)/2 min = 1000/min,
    //NOT a spike off the dropped 4k-sample minute.
    expect(rate.get(8)).toBeCloseTo(1000, 6);
  });

  it('dropLowSamplePoints keeps only points at or above MIN_SAMPLE_FRACTION * peak', () => {
    const kept = dropLowSamplePoints(series.points, (p) => p.sample_players);
    expect(kept.map((p) => p.sample_players)).toEqual([370000, 368000]);
    expect(kept.every((p) => p.sample_players >= MIN_SAMPLE_FRACTION * 370000)).toBe(true);
  });

  it('keeps every point on a uniformly-sampled curve (peak-relative, not absolute)', () => {
    const uniform = laneCurve([lanePt(180, 1, 40), lanePt(360, 3, 40), lanePt(540, 6, 40)]);
    expect(laneSeriesByMinute(uniform, 1, 'total').size).toBe(3);
  });

  it('applies the same filter to the player line, keyed on its match count', () => {
    //The player's own line carries `matches`, not `sample_players`; a minute reached by far
    //fewer of their games is the personal-curve analog of a straggler and is dropped too.
    const pts = [playerPt(360, 5000, 400), playerPt(420, 6000, 4), playerPt(480, 7000, 396)];
    const out = playerSeriesByMinute(pts, 'total');
    expect(out.has(7)).toBe(false);
    expect([...out.keys()]).toEqual([6, 8]);
  });
});
