import { describe, it, expect } from 'vitest';
import { MIN_SAMPLE_FRACTION, RANK_MIN_SAMPLE, SOULS_AT_ZERO } from './laneCurve';

describe('lane constants', () => {
  it('pins the game-start souls, the league sample floor and the tail-guard fraction', () => {
    expect(SOULS_AT_ZERO).toBe(600);
    expect(RANK_MIN_SAMPLE).toBe(500);
    expect(MIN_SAMPLE_FRACTION).toBe(0.05);
  });
});
