import { describe, it, expect } from 'vitest';
import { MIN_PERCENTILE_SAMPLE, percentileOrdinal, topPercentFromFraction } from './percentile';
import { DASH } from './format';

//The API serves PERCENT_RANK() as a 0–1 fraction; the UI shows whole ordinals.

describe('percentileOrdinal', () => {
  it('formats 0.0 as "0th"', () => {
    expect(percentileOrdinal(0.0)).toBe('0th');
  });
  it('rounds 0.005 up to "1st"', () => {
    expect(percentileOrdinal(0.005)).toBe('1st');
  });
  it('formats 0.5 as "50th"', () => {
    expect(percentileOrdinal(0.5)).toBe('50th');
  });
  it('formats 0.87 as "87th"', () => {
    expect(percentileOrdinal(0.87)).toBe('87th');
  });
  it('clamps 0.999 to "99th" — "100th" is reserved for exactly 1.0', () => {
    expect(percentileOrdinal(0.999)).toBe('99th');
  });
  it('formats exactly 1.0 as "100th"', () => {
    expect(percentileOrdinal(1.0)).toBe('100th');
  });
  it('keeps the teen exceptions and the 21/22/23 suffixes', () => {
    expect(percentileOrdinal(0.11)).toBe('11th');
    expect(percentileOrdinal(0.12)).toBe('12th');
    expect(percentileOrdinal(0.13)).toBe('13th');
    expect(percentileOrdinal(0.21)).toBe('21st');
    expect(percentileOrdinal(0.22)).toBe('22nd');
    expect(percentileOrdinal(0.23)).toBe('23rd');
  });
  it('clamps out-of-contract fractions into 0th–100th', () => {
    expect(percentileOrdinal(-0.2)).toBe('0th');
    expect(percentileOrdinal(1.4)).toBe('100th');
  });
  it('renders the dash for null / undefined / NaN', () => {
    expect(percentileOrdinal(null)).toBe(DASH);
    expect(percentileOrdinal(undefined)).toBe(DASH);
    expect(percentileOrdinal(NaN)).toBe(DASH);
  });
});

describe('topPercentFromFraction', () => {
  it('inverts the 0–1 contract: 0.5 → Top 50%, not Top 99%/100%', () => {
    expect(topPercentFromFraction(0.5)).toBe(50);
  });
  it('formats 0.87 as Top 13%', () => {
    expect(topPercentFromFraction(0.87)).toBe(13);
  });
  it('floors at 1 so a perfect 1.0 prints "Top 1%", never "Top 0%"', () => {
    expect(topPercentFromFraction(1.0)).toBe(1);
  });
  it('lets a 0.0 percentile read an honest Top 100%', () => {
    expect(topPercentFromFraction(0.0)).toBe(100);
  });
});

describe('MIN_PERCENTILE_SAMPLE', () => {
  it('is pinned at 10 matches', () => {
    expect(MIN_PERCENTILE_SAMPLE).toBe(10);
  });
});
