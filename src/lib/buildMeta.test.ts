import { describe, it, expect } from 'vitest';
import { isUpdatedThisPatch, formatUpdated, abilityOrderSequence, sortLabel } from './buildMeta';

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
