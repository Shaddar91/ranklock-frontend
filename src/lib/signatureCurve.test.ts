import { describe, it, expect } from 'vitest';
import { mergeSignatureCurve, curveMarker, signatureDelta } from './signatureCurve';
import type { SignaturePoint } from '../components/react/charts/SignatureCurve';
import type {
  PlayerCurvePoint,
  PlayerCurveComparisonPoint,
  PlayerEconomyCurveResponse,
} from '../types/api';

//Fixture builders — the backend serves two independent per-minute series that
//mergeSignatureCurve unions by game minute (t_seconds / 60, rounded).
const youPt = (t_seconds: number, value: number): PlayerCurvePoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  value,
  matches: 5,
});
const cmpPt = (
  t_seconds: number,
  p25: number | null,
  p50: number | null,
  p75: number | null,
): PlayerCurveComparisonPoint => ({
  minute_bucket: t_seconds / 180,
  t_seconds,
  p25,
  p50,
  p75,
  sample_players: 50,
});
const resp = (
  you: PlayerCurvePoint[],
  cmp: PlayerCurveComparisonPoint[] | null,
): PlayerEconomyCurveResponse => ({
  account_id: 1,
  metric: 'souls',
  points: [],
  you,
  comparison:
    cmp == null
      ? null
      : {
          band: 2,
          hero_id: null,
          source: 'cohort-gold',
          cohort: 'team_average',
          rank: null,
          tier: null,
          division: null,
          points: cmp,
        },
});

describe('mergeSignatureCurve', () => {
  it('returns an empty array for an undefined response', () => {
    expect(mergeSignatureCurve(undefined)).toEqual([]);
  });

  it('keys the `you` series by game minute and sorts ascending', () => {
    //Fed out of order (min 6 before min 3) — output must come back sorted.
    const out = mergeSignatureCurve(resp([youPt(360, 2500), youPt(180, 1000)], null));
    expect(out).toEqual([
      { min: 3, you: 1000 },
      { min: 6, you: 2500 },
    ]);
  });

  it('maps a comparison point to cmp (p50) and band ([p25, p75])', () => {
    const [pt] = mergeSignatureCurve(resp([], [cmpPt(180, 800, 1000, 1200)]));
    expect(pt).toEqual({ min: 3, cmp: 1000, band: [800, 1200] });
  });

  it('drops the band when either p25 or p75 is null, but keeps cmp', () => {
    const [pt] = mergeSignatureCurve(resp([], [cmpPt(180, null, 1000, 1200)]));
    expect(pt?.cmp).toBe(1000);
    expect(pt?.band).toBeUndefined();
  });

  it('leaves cmp undefined when p50 is null', () => {
    const [pt] = mergeSignatureCurve(resp([], [cmpPt(180, 800, null, 1200)]));
    expect(pt?.cmp).toBeUndefined();
    expect(pt?.band).toEqual([800, 1200]);
  });

  it('unions `you` and the cohort onto the same minute datum', () => {
    const out = mergeSignatureCurve(resp([youPt(180, 1000)], [cmpPt(180, 800, 900, 1000)]));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ min: 3, you: 1000, cmp: 900, band: [800, 1000] });
  });

  it('rounds t_seconds to the nearest whole game minute', () => {
    const out = mergeSignatureCurve(resp([youPt(180, 1), youPt(540, 3)], null));
    expect(out.map((p) => p.min)).toEqual([3, 9]);
  });
});

describe('curveMarker', () => {
  const points: SignaturePoint[] = [
    { min: 3, you: 1000, cmp: 900 },
    { min: 9, you: 3000, cmp: 2800 },
  ];

  it('returns the both-series point nearest the target minute, with gap = you - cmp', () => {
    expect(curveMarker(points, 10)).toEqual({ min: 9, you: 3000, cmp: 2800, gap: 200 });
  });

  it('defaults the target minute to 10', () => {
    expect(curveMarker(points)).toEqual({ min: 9, you: 3000, cmp: 2800, gap: 200 });
  });

  it('reports a negative gap when you is behind the cohort', () => {
    const marker = curveMarker([{ min: 10, you: 2000, cmp: 2500 }]);
    expect(marker?.gap).toBe(-500);
  });

  it('skips points missing either series', () => {
    const marker = curveMarker([
      { min: 10, you: 2000 },
      { min: 6, you: 1500, cmp: 1400 },
    ]);
    expect(marker).toEqual({ min: 6, you: 1500, cmp: 1400, gap: 100 });
  });

  it('returns null when no point has both series', () => {
    expect(curveMarker([{ min: 3, you: 1000 }, { min: 9, cmp: 2800 }])).toBeNull();
    expect(curveMarker([])).toBeNull();
  });
});

describe('signatureDelta', () => {
  it('emits the signed gap and the band re-centred on the cohort median', () => {
    const out = signatureDelta([{ min: 3, you: 1000, cmp: 900, band: [800, 1000] }]);
    expect(out).toEqual([{ min: 3, delta: 100, deltaBand: [-100, 100] }]);
  });

  it('drops points missing either your curve or the cohort median', () => {
    const out = signatureDelta([
      { min: 3, you: 1000 },
      { min: 6, cmp: 900 },
      { min: 9, you: 2000, cmp: 1800, band: [1700, 1900] },
    ]);
    expect(out).toEqual([{ min: 9, delta: 200, deltaBand: [-100, 100] }]);
  });

  it('reports a negative delta when behind, and the band still straddles zero', () => {
    const out = signatureDelta([{ min: 10, you: 1500, cmp: 2000, band: [1800, 2400] }]);
    expect(out).toEqual([{ min: 10, delta: -500, deltaBand: [-200, 400] }]);
  });

  it('omits deltaBand when the cohort had no band at that minute', () => {
    expect(signatureDelta([{ min: 3, you: 1000, cmp: 900 }])).toEqual([{ min: 3, delta: 100 }]);
  });

  it('returns an empty array when no point has both series', () => {
    expect(signatureDelta([{ min: 3, you: 1000 }, { min: 9, cmp: 900 }])).toEqual([]);
    expect(signatureDelta([])).toEqual([]);
  });
});
