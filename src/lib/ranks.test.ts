import { describe, it, expect } from 'vitest';
import { chasingTier, getRank, rankFromBadge } from './ranks';

//chasingTier is the ONE lifted "rank you're chasing" source for the profile page:
//the Signature title and the curve's LEAGUE default both derive from it.
describe('chasingTier', () => {
  it('is one tier above the badge tier', () => {
    expect(chasingTier(22)).toBe(3);
    expect(chasingTier(62)).toBe(7);
    expect(chasingTier(5)).toBe(1);
  });
  it('clamps at the ladder top', () => {
    expect(chasingTier(111)).toBe(11);
    expect(chasingTier(116)).toBe(11);
  });
  it('is null when the badge is unknown', () => {
    expect(chasingTier(null)).toBeNull();
    expect(chasingTier(undefined)).toBeNull();
    expect(chasingTier(0)).toBeNull();
  });
  it('names the chase via getRank — no hardcoded rank names', () => {
    const badge = 22;
    expect(getRank(rankFromBadge(badge)!.tier).name).toBe('Seeker');
    expect(getRank(chasingTier(badge)!).name).toBe('Alchemist');
  });
});
