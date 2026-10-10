import { describe, expect, it } from 'vitest';
import { bucketValue, curveMetrics, type BulkState } from './laneScorecard';
import type { PlayerCurvePoint } from '../types/api';

const ALL = ['damage', 'souls', 'accuracy'];
const WINDOWED = ['damage', 'souls'];
const settled = (...ids: number[]): BulkState => ({
  failed: false,
  settled: { accounts: ids.map((account_id) => ({ account_id, values: {} })), leagues: [] },
});
const pt = (minute_bucket: number, value: number): PlayerCurvePoint => ({
  minute_bucket,
  t_seconds: minute_bucket * 180,
  value,
  matches: 3,
});

describe('curveMetrics', () => {
  it('reads every metric off the curve when the bulk read failed', () => {
    expect(curveMetrics({ failed: true, settled: null }, 1, 40, ALL, [])).toEqual(ALL);
    expect(curveMetrics({ failed: true, settled: null }, 1, 40, ALL, WINDOWED)).toEqual(ALL);
  });

  it('reads nothing off the curve for an account the bulk read carries, unless a window is on', () => {
    expect(curveMetrics(settled(1, 2), 2, 40, ALL, [])).toEqual([]);
    expect(curveMetrics(settled(1, 2), 2, 40, ALL, WINDOWED)).toEqual(WINDOWED);
  });

  it('falls back to the curve for an account the settled bulk read left out', () => {
    expect(curveMetrics(settled(1), 2, 40, ALL, [])).toEqual(ALL);
    expect(curveMetrics(settled(1), 2, null, ALL, [])).toEqual(ALL);
    expect(curveMetrics(settled(), 2, undefined, ALL, WINDOWED)).toEqual(ALL);
  });

  it('skips the fallback for a left-out account with no games in the mode', () => {
    expect(curveMetrics(settled(1), 2, 0, ALL, [])).toEqual([]);
    expect(curveMetrics(settled(1), 2, 0, ALL, WINDOWED)).toEqual(WINDOWED);
  });

  it('waits for the bulk read before falling back', () => {
    expect(curveMetrics({ failed: false, settled: null }, 2, 40, ALL, [])).toEqual([]);
    expect(curveMetrics({ failed: false, settled: null }, 2, 40, ALL, WINDOWED)).toEqual(WINDOWED);
  });
});

describe('bucketValue', () => {
  it('reads the point at the bucket', () => {
    expect(bucketValue([pt(4, 1200), pt(12, 5300)], 12)).toBe(5300);
  });

  it('is null for a missing bucket or an empty curve', () => {
    expect(bucketValue([pt(4, 1200)], 12)).toBeNull();
    expect(bucketValue([], 4)).toBeNull();
  });

  it('is null across an all-zero series, which is an unfolded array', () => {
    expect(bucketValue([pt(4, 0), pt(12, 0)], 4)).toBeNull();
  });
});
