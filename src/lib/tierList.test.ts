import { describe, expect, it } from 'vitest';
import { TIER_CUTS, cutLabel, gradedCount, tierBlocks, type TierRow } from './tierList';

const hero = (hero_id: number, hero_name: string, win_rate: number | null, picks = 100): TierRow => ({
  hero_id,
  hero_name,
  icon_url: null,
  picks,
  win_rate,
});

describe('TIER_CUTS', () => {
  it('runs S to F with strictly descending thresholds and an open bottom', () => {
    expect(TIER_CUTS.map((c) => c.tier)).toEqual(['S', 'A', 'B', 'C', 'D', 'F']);
    const mins = TIER_CUTS.slice(0, -1).map((c) => c.min as number);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(TIER_CUTS[5]?.min).toBeNull();
  });
});

describe('cutLabel', () => {
  it('states a bounded cut as "X and above"', () => {
    expect(cutLabel({ tier: 'S', min: 52.5 }, undefined)).toBe('52.5% and above');
  });
  it('states the bottom cut against the tier above it', () => {
    expect(cutLabel({ tier: 'F', min: null }, { tier: 'D', min: 47 })).toBe('below 47.0%');
  });
});

describe('tierBlocks', () => {
  it('returns all six blocks even when a tier is empty at this rank', () => {
    const blocks = tierBlocks([hero(1, 'Alpha', 55)]);
    expect(blocks).toHaveLength(6);
    expect(blocks[0]?.heroes.map((h) => h.hero_name)).toEqual(['Alpha']);
    expect(blocks[5]?.heroes).toEqual([]);
    expect(blocks[5]?.lowest).toBeNull();
  });

  it('places each hero in the tier metaTier grades it', () => {
    const blocks = tierBlocks([
      hero(1, 'Ess', 52.5),
      hero(2, 'Ay', 51),
      hero(3, 'Bee', 49.5),
      hero(4, 'Cee', 48),
      hero(5, 'Dee', 47),
      hero(6, 'Eff', 46.9),
    ]);
    expect(blocks.map((b) => b.heroes[0]?.hero_name)).toEqual(['Ess', 'Ay', 'Bee', 'Cee', 'Dee', 'Eff']);
  });

  it('orders a block by win rate and aggregates its span and picks', () => {
    const blocks = tierBlocks([hero(1, 'Low', 53, 10), hero(2, 'High', 55.9, 40), hero(3, 'Mid', 54, 50)]);
    const s = blocks[0];
    expect(s?.heroes.map((h) => h.hero_name)).toEqual(['High', 'Mid', 'Low']);
    expect(s?.highest).toBe(55.9);
    expect(s?.lowest).toBe(53);
    expect(s?.picks).toBe(100);
  });

  it('drops an unmeasured hero instead of grading it F', () => {
    const blocks = tierBlocks([hero(1, 'Untracked', null, 0), hero(2, 'Rated', 44)]);
    expect(gradedCount(blocks)).toBe(1);
    expect(blocks[5]?.heroes.map((h) => h.hero_name)).toEqual(['Rated']);
  });

  it('labels the bottom block against the D threshold', () => {
    expect(tierBlocks([])[5]?.label).toBe('below 47.0%');
  });
});
