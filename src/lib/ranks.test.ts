import { describe, it, expect } from 'vitest';
import { chasingTier, getRank, rankFromBadge, rankImg, RANKS } from './ranks';

//The assets.deadlock-api.com /v2/ranks ladder pinned 2026-09-11 — Acolyte/Sentinel/Mystic
//replaced Alchemist/Arcanist/Ritualist at 3-5 and Archon left the ladder entirely.
describe('RANKS', () => {
  it('is the pinned 12-tier ladder, index === tier', () => {
    expect(RANKS.map((r) => r.name)).toEqual([
      'Obscurus',
      'Initiate',
      'Seeker',
      'Acolyte',
      'Sentinel',
      'Mystic',
      'Ritualist',
      'Emissary',
      'Oracle',
      'Phantom',
      'Ascendant',
      'Eternus',
    ]);
    expect(RANKS.every((r, i) => r.tier === i)).toBe(true);
  });
  it('has no Archon — the tier the ladder deleted', () => {
    expect(RANKS.some((r) => r.name === 'Archon')).toBe(false);
  });
  it('keys emblems by tier, not name, so a rename cannot 404 the art', () => {
    expect(rankImg(5)).toBe('/assets/ranks/rank05.png');
    expect(rankImg(11)).toBe('/assets/ranks/rank11.png');
  });
});

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
    expect(getRank(chasingTier(badge)!).name).toBe('Acolyte');
  });
});
