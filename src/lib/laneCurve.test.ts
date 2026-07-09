import { describe, it, expect } from 'vitest';
import { laneSeriesByMinute, playerSeriesByMinute } from './laneCurve';
import type { LaneCurvePoint, LaneCurveResponse, PlayerCurvePoint } from '../types/api';

//The lane curve buckets are 180s apart; souls are encoded as net_worth/1000 so the
//chart passes scale=1000 to recover real souls. 'total' = cumulative p50*scale;
//'rate' = per-minute amount gained across each 3-minute bucket, first bucket omitted.
const lanePt = (t_seconds: number, p50: number | null): LaneCurvePoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  sample_players: 50,
  p25: null,
  p50,
  p75: null,
});
const laneCurve = (points: LaneCurvePoint[]): LaneCurveResponse => ({ band: 2, metric: 'souls', points });
const playerPt = (t_seconds: number, value: number): PlayerCurvePoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  value,
  matches: 5,
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
