import { describe, it, expect } from 'vitest';
import { bracketBucket, servedBandLabel } from './heroBracket';

describe('bracketBucket — a picked tier resolves to the band the routes serve', () => {
  it('maps the 11 ranked tiers onto the backend 1-5 badge brackets', () => {
    expect([1, 2, 3].map(bracketBucket)).toEqual([1, 1, 1]);
    expect([4, 5].map(bracketBucket)).toEqual([2, 2]);
    expect([6, 7].map(bracketBucket)).toEqual([3, 3]);
    expect([8, 9].map(bracketBucket)).toEqual([4, 4]);
    expect([10, 11].map(bracketBucket)).toEqual([5, 5]);
  });

  it('sends no bracket param for "all", and none for the unranked tier', () => {
    expect(bracketBucket('all')).toBeUndefined();
    expect(bracketBucket(0)).toBeUndefined();
  });
});

describe('servedBandLabel — names the band off the pinned ladder', () => {
  it('states the tiers a pick actually covers', () => {
    expect(servedBandLabel(3)).toBe('Initiate – Acolyte');
    expect(servedBandLabel(5)).toBe('Sentinel – Mystic');
    expect(servedBandLabel(11)).toBe('Ascendant – Eternus');
    expect(servedBandLabel('all')).toBe('All ranks');
  });

  it('carries no retired rank name', () => {
    const labels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(servedBandLabel).join(' ');
    expect(labels).not.toMatch(/Archon|Alchemist|Arcanist/);
  });
});
