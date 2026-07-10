import { describe, it, expect } from 'vitest';
import { ECONOMY_CURVE_DATASET, datasetWindowLabel, statsThroughDate } from './dataHorizon';
import type { DataHorizonResponse } from '../types/api';

//Data-age honesty (Component 11): every formatter here must yield null — meaning
//"render nothing" — for an unknown horizon, so the chip/captions can never show a
//fake or fabricated date. Dates always derive from the served payload.

const horizon = (over: Partial<DataHorizonResponse> = {}): DataHorizonResponse => ({
  max_match_start_time: '2026-06-10T21:34:00Z',
  datasets: [
    {
      dataset: ECONOMY_CURVE_DATASET,
      window_lo: '2026-04-01T00:00:00Z',
      window_hi: '2026-06-01T00:00:00Z',
      computed_at: '2026-07-01T06:00:00Z',
    },
  ],
  ...over,
});

describe('statsThroughDate (the chip date)', () => {
  it('formats the global ingestion horizon as a short date', () => {
    expect(statsThroughDate(horizon())).toBe('Jun 10, 2026');
  });

  it('is null when the horizon is unknown — absent payload, null field, or junk', () => {
    expect(statsThroughDate(undefined)).toBeNull();
    expect(statsThroughDate(null)).toBeNull();
    expect(statsThroughDate(horizon({ max_match_start_time: null }))).toBeNull();
    expect(statsThroughDate(horizon({ max_match_start_time: 'not-a-date' }))).toBeNull();
  });
});

describe('datasetWindowLabel (the band-caption sample window)', () => {
  it('renders the economy-curve lineage window as a date span', () => {
    expect(datasetWindowLabel(horizon(), ECONOMY_CURVE_DATASET)).toBe('Apr 1, 2026 – Jun 1, 2026');
  });

  it('is null when the dataset has no lineage entry', () => {
    expect(datasetWindowLabel(horizon({ datasets: [] }), ECONOMY_CURVE_DATASET)).toBeNull();
    expect(datasetWindowLabel(horizon(), 'hero-matchups')).toBeNull();
  });

  it('is null for a half window — never an open-ended fabricated range', () => {
    const half = horizon({
      datasets: [
        { dataset: ECONOMY_CURVE_DATASET, window_lo: null, window_hi: '2026-06-01T00:00:00Z', computed_at: null },
      ],
    });
    expect(datasetWindowLabel(half, ECONOMY_CURVE_DATASET)).toBeNull();
    const otherHalf = horizon({
      datasets: [
        { dataset: ECONOMY_CURVE_DATASET, window_lo: '2026-04-01T00:00:00Z', window_hi: null, computed_at: null },
      ],
    });
    expect(datasetWindowLabel(otherHalf, ECONOMY_CURVE_DATASET)).toBeNull();
  });

  it('is null when the horizon payload itself is absent', () => {
    expect(datasetWindowLabel(undefined, ECONOMY_CURVE_DATASET)).toBeNull();
    expect(datasetWindowLabel(null, ECONOMY_CURVE_DATASET)).toBeNull();
  });
});
