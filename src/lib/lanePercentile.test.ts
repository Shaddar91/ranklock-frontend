import { describe, expect, it } from 'vitest';
import {
  SCORECARD_BUCKETS,
  SCORECARD_METRICS,
  bucketClock,
  percentileChip,
  weakestCells,
} from './lanePercentile';

describe('percentileChip', () => {
  it('names the nearer edge, so a strong player reads top not bottom', () => {
    expect(percentileChip(0.91).label).toBe('top 9%');
    expect(percentileChip(0.18).label).toBe('bottom 18%');
  });

  it('inverts deaths and says which direction it means', () => {
    //18% of the league dies less than you -> you die more than 82% of it: weak, and "more".
    const dying = percentileChip(0.18, true);
    expect(dying.standing).toBe(82);
    expect(dying.label).toBe('top 18% (fewer)');
    const surviving = percentileChip(0.91, true);
    expect(surviving.standing).toBe(9);
    expect(surviving.label).toBe('bottom 9% (more)');
  });

  it('tones on the standing, not the printed edge', () => {
    expect(percentileChip(0.1).tone).toBe('weak');
    expect(percentileChip(0.5).tone).toBe('mid');
    expect(percentileChip(0.9).tone).toBe('strong');
    //a low death share is a GOOD standing even though the number is small
    expect(percentileChip(0.1, true).tone).toBe('strong');
  });

  it('clamps a share outside 0..1', () => {
    expect(percentileChip(-0.2).standing).toBe(0);
    expect(percentileChip(1.4).standing).toBe(100);
  });
});

describe('weakestCells', () => {
  it('marks exactly the two lowest standings', () => {
    expect(weakestCells([80, 12, 55, 30])).toEqual([false, true, false, true]);
  });

  it('never marks a cell with no percentile', () => {
    expect(weakestCells([null, 40, null, 90])).toEqual([false, true, false, true]);
    expect(weakestCells([null, null])).toEqual([false, false]);
  });

  it('breaks ties by position instead of marking every tied cell', () => {
    expect(weakestCells([20, 20, 20, 90])).toEqual([true, true, false, false]);
  });
});

describe('scorecard shape', () => {
  it('carries the eleven histogram metrics and inverts only deaths', () => {
    expect(SCORECARD_METRICS).toHaveLength(11);
    expect(SCORECARD_METRICS.filter((m) => m.inverted).map((m) => m.key)).toEqual(['deaths']);
  });

  it('reads the design presets off the 180s bucket axis', () => {
    expect(SCORECARD_BUCKETS.map(bucketClock)).toEqual(['12:00', '36:00']);
  });
});
