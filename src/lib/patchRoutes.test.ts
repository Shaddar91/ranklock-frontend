import { describe, it, expect } from 'vitest';
import { mintablePatches } from './patchRoutes';
import type { Patch } from '../types/api';

//Which registry rows get a /patches/<id>/ page. The sitemap imports the same
//predicate, so a change here must stay intentional.

const patch = (patch_id: string, released_at: string, notes_url: string | null): Patch => ({
  patch_id,
  version_label: `${patch_id} Update`,
  released_at,
  ended_at: null,
  notes_url,
  notes_summary: null,
  is_current: false,
});

const NOTES = 'https://example.invalid/changelogs/raw.txt';

describe('mintablePatches', () => {
  it('keeps only rows released on/after the floor that carry a changelog url', () => {
    const rows = [
      patch('2026-06-04', '2026-06-04T00:00:00Z', NOTES),
      patch('2026-05-31', '2026-05-31T00:00:00Z', null),
      patch('2025-12-30', '2025-12-30T00:00:00Z', NOTES),
      patch('2026-01-01', '2026-01-01T00:00:00Z', NOTES),
    ];
    expect(mintablePatches(rows).map((p) => p.patch_id)).toEqual(['2026-06-04', '2026-01-01']);
  });

  it('sorts newest first', () => {
    const rows = [
      patch('2026-06-04', '2026-06-04T00:00:00Z', NOTES),
      patch('2026-08-22', '2026-08-22T00:00:00Z', NOTES),
      patch('2026-07-09', '2026-07-09T00:00:00Z', NOTES),
    ];
    expect(mintablePatches(rows).map((p) => p.patch_id)).toEqual(['2026-08-22', '2026-07-09', '2026-06-04']);
  });

  it('yields an empty family for an empty registry', () => {
    expect(mintablePatches([])).toEqual([]);
  });

  it('does not mutate the input order', () => {
    const rows = [
      patch('2026-06-04', '2026-06-04T00:00:00Z', NOTES),
      patch('2026-08-22', '2026-08-22T00:00:00Z', NOTES),
    ];
    mintablePatches(rows);
    expect(rows.map((p) => p.patch_id)).toEqual(['2026-06-04', '2026-08-22']);
  });
});
