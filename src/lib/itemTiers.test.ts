import { describe, it, expect } from 'vitest';
import { ITEM_TIERS, ITEM_TIER_COST, itemTierCost, itemTierLabel, itemTierNumeral } from './itemTiers';

describe('item tiers', () => {
  it('runs I-V — Tier V is in the ladder, not excluded', () => {
    expect(ITEM_TIERS.map((t) => t.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V']);
    expect(itemTierCost(5)).toBe(9999);
    expect(itemTierLabel(5)).toBe('Tier V · Apex');
  });
  it('mirrors the client price array, index === tier', () => {
    expect(ITEM_TIER_COST).toEqual([0, 800, 1600, 3200, 6400, 9999]);
    expect(ITEM_TIERS.every((t) => ITEM_TIER_COST[t.tier] === t.cost)).toBe(true);
  });
  it('is null for an unknown tier rather than a guessed price', () => {
    expect(itemTierCost(0)).toBeNull();
    expect(itemTierCost(6)).toBeNull();
    expect(itemTierCost(null)).toBeNull();
    expect(itemTierNumeral(undefined)).toBeNull();
    expect(itemTierLabel(9)).toBeNull();
  });
});
