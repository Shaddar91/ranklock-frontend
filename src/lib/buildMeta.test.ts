import { describe, it, expect } from 'vitest';
import { isUpdatedThisPatch, formatUpdated, abilityOrderSequence, sortLabel, authorLabel, favoriteCounts } from './buildMeta';

const PATCH = '2026-08-22';
const patchStart = Math.floor(Date.parse('2026-08-22T00:00:00Z') / 1000);

describe('buildMeta — updated-this-patch badge', () => {
  it('true at/after the patch start, false before', () => {
    expect(isUpdatedThisPatch(patchStart + 3600, PATCH)).toBe(true);
    expect(isUpdatedThisPatch(patchStart, PATCH)).toBe(true);
    expect(isUpdatedThisPatch(patchStart - 1, PATCH)).toBe(false);
  });
  it('false on missing timestamp or patch', () => {
    expect(isUpdatedThisPatch(null, PATCH)).toBe(false);
    expect(isUpdatedThisPatch(patchStart, null)).toBe(false);
  });
});

describe('buildMeta — relative updated label', () => {
  const now = Math.floor(Date.parse('2026-08-30T00:00:00Z') / 1000);
  it('buckets recent updates and dates old ones', () => {
    expect(formatUpdated(now, now)).toBe('today');
    expect(formatUpdated(now - 3 * 86400, now)).toBe('3d ago');
    expect(formatUpdated(now - 21 * 86400, now)).toBe('3w ago');
    expect(formatUpdated(Math.floor(Date.parse('2024-10-23T00:00:00Z') / 1000), now)).toMatch(/2024/);
    expect(formatUpdated(null, now)).toBe('—');
  });
});

describe('buildMeta — ability order sequence', () => {
  it('extracts distinct ability ids in first-appearance order', () => {
    const blob = {
      currency_changes: [
        { ability_id: 100, currency_type: 2, delta: -1 },
        { ability_id: 200, currency_type: 2, delta: -1 },
        { ability_id: 100, currency_type: 1, delta: -1 },
        { ability_id: 300, currency_type: 1, delta: -1 },
        { ability_id: 200, currency_type: 1, delta: -1 },
      ],
    };
    expect(abilityOrderSequence(blob)).toEqual([100, 200, 300]);
  });
  it('tolerates missing / malformed blobs', () => {
    expect(abilityOrderSequence(null)).toEqual([]);
    expect(abilityOrderSequence({})).toEqual([]);
    expect(abilityOrderSequence({ currency_changes: 'x' })).toEqual([]);
  });
});

describe('buildMeta — sort labels', () => {
  it('names the two honest sorts', () => {
    expect(sortLabel('weekly')).toBe('Trending');
    expect(sortLabel('favorites')).toBe('All-time');
  });
});

describe('buildMeta — build attribution', () => {
  it('prints the resolved name, else the account id, never an invented name', () => {
    expect(authorLabel({ author_name: 'back3p\u2122', author_account_id: 1183614423 })).toBe('back3p\u2122');
    expect(authorLabel({ author_name: null, author_account_id: 1183614423 })).toBe('Steam account 1183614423');
    expect(authorLabel({ author_name: '   ', author_account_id: 7 })).toBe('Steam account 7');
    expect(authorLabel({ author_account_id: 7 })).toBe('Steam account 7');
  });
});

describe('buildMeta — favorite counts', () => {
  it('shows both counts weekly-first and omits the ones upstream withheld', () => {
    expect(favoriteCounts({ num_weekly_favorites: 14841, num_favorites: 90210 })).toEqual([
      { label: 'weekly favorites', value: 14841 },
      { label: 'all-time favorites', value: 90210 },
    ]);
    expect(favoriteCounts({ num_weekly_favorites: 14841, num_favorites: null })).toEqual([
      { label: 'weekly favorites', value: 14841 },
    ]);
    expect(favoriteCounts({ num_weekly_favorites: null, num_favorites: 5 })).toEqual([
      { label: 'all-time favorites', value: 5 },
    ]);
    expect(favoriteCounts({})).toEqual([]);
  });
  it('keeps a real zero', () => {
    expect(favoriteCounts({ num_weekly_favorites: 0 })).toEqual([{ label: 'weekly favorites', value: 0 }]);
  });
});
