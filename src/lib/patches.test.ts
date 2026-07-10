import { describe, it, expect } from 'vitest';
import { isOldestPatch } from './patches';
import type { Patch } from '../types/api';

//Oldest-patch predicate (deep-audit B8): the first tracked patch has nothing
//earlier to diff against, so its movers empty-state must say that instead of
//"No gainers for this bracket".

const patch = (patch_id: string, released_at: string, is_current = false): Patch => ({
  patch_id,
  version_label: patch_id,
  released_at,
  ended_at: null,
  notes_url: null,
  notes_summary: null,
  is_current,
});

const PATCHES: Patch[] = [
  patch('2026-06-10', '2026-06-10T00:00:00Z', true),
  patch('2026-05-31', '2026-05-31T00:00:00Z'),
  patch('2026-04-30', '2026-04-30T00:00:00Z'),
];

describe('isOldestPatch', () => {
  it('is true only for the min-released_at patch', () => {
    expect(isOldestPatch(PATCHES, '2026-04-30')).toBe(true);
    expect(isOldestPatch(PATCHES, '2026-05-31')).toBe(false);
    expect(isOldestPatch(PATCHES, '2026-06-10')).toBe(false);
  });
  it('is order-independent (works on the newest-first sort the island uses)', () => {
    const reversed = [...PATCHES].reverse();
    expect(isOldestPatch(reversed, '2026-04-30')).toBe(true);
    expect(isOldestPatch(reversed, '2026-06-10')).toBe(false);
  });
  it('treats a single tracked patch as the oldest', () => {
    expect(isOldestPatch([patch('2026-04-30', '2026-04-30T00:00:00Z', true)], '2026-04-30')).toBe(true);
  });
  it('is true for every patch tied at the earliest released_at', () => {
    const tied = [...PATCHES, patch('2026-04-30-b', '2026-04-30T00:00:00Z')];
    expect(isOldestPatch(tied, '2026-04-30')).toBe(true);
    expect(isOldestPatch(tied, '2026-04-30-b')).toBe(true);
  });
  it('is false for unknown / null ids and an empty list', () => {
    expect(isOldestPatch(PATCHES, 'nope')).toBe(false);
    expect(isOldestPatch(PATCHES, null)).toBe(false);
    expect(isOldestPatch(PATCHES, undefined)).toBe(false);
    expect(isOldestPatch([], '2026-04-30')).toBe(false);
  });
});
