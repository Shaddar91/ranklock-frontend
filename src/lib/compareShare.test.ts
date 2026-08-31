import { describe, expect, it } from 'vitest';
import { compareSelectionQuery, compareSharePath, compareShareUrl, readComparePair } from './compareShare';

describe('compareShareUrl', () => {
  it('builds the canonical share URL for a pair', () => {
    expect(compareShareUrl(76561198, 123456)).toBe('https://ranklock.app/compare/76561198/123456/');
  });

  it('builds the site-relative path', () => {
    expect(compareSharePath(1, 2)).toBe('/compare/1/2/');
  });

  it('omits every default (all-heroes / Normal / Unranked) so the link stays canonical', () => {
    const sel = { hero_id: 0, game_mode: 'Normal' as const, match_mode: 'Unranked' as const };
    expect(compareShareUrl(1, 2, sel)).toBe('https://ranklock.app/compare/1/2/');
    expect(compareSharePath(1, 2, sel)).toBe('/compare/1/2/');
  });

  it('appends a non-default hero after the trailing slash', () => {
    expect(compareShareUrl(1, 2, { hero_id: 6 })).toBe('https://ranklock.app/compare/1/2/?hero=6');
  });

  it('appends the ranked axis when match_mode is Ranked', () => {
    expect(compareShareUrl(1, 2, { match_mode: 'Ranked' })).toBe('https://ranklock.app/compare/1/2/?ranked=1');
  });

  it('appends the brawl slug when game_mode is StreetBrawl', () => {
    expect(compareShareUrl(1, 2, { game_mode: 'StreetBrawl' })).toBe('https://ranklock.app/compare/1/2/?mode=brawl');
  });

  it('carries hero + both mode axes in a stable order', () => {
    const sel = { hero_id: 15, game_mode: 'StreetBrawl' as const, match_mode: 'Ranked' as const };
    expect(compareShareUrl(1, 2, sel)).toBe('https://ranklock.app/compare/1/2/?hero=15&mode=brawl&ranked=1');
  });
});

describe('compareSelectionQuery', () => {
  it('is empty for no selection and for an all-default selection', () => {
    expect(compareSelectionQuery()).toBe('');
    expect(compareSelectionQuery({ hero_id: 0, game_mode: 'Normal', match_mode: 'Unranked' })).toBe('');
  });

  it('ignores a non-positive hero_id', () => {
    expect(compareSelectionQuery({ hero_id: 0 })).toBe('');
    expect(compareSelectionQuery({ hero_id: 6 })).toBe('?hero=6');
  });

  it('emits hero, mode, ranked in insertion order', () => {
    expect(
      compareSelectionQuery({ hero_id: 6, game_mode: 'StreetBrawl', match_mode: 'Ranked' }),
    ).toBe('?hero=6&mode=brawl&ranked=1');
  });
});

describe('readComparePair', () => {
  it('reads both ids from a compare pathname', () => {
    expect(readComparePair('/compare/123/456')).toEqual({ a: 123, b: 456 });
  });

  it('tolerates a locale prefix and a trailing slash', () => {
    expect(readComparePair('/fr/compare/123/456/')).toEqual({ a: 123, b: 456 });
  });

  it('reads the pair even with a trailing selection query', () => {
    expect(readComparePair('/compare/123/456/?hero=6&ranked=1')).toEqual({ a: 123, b: 456 });
  });

  it('rejects a missing second id', () => {
    expect(readComparePair('/compare/123')).toBeNull();
  });

  it('rejects non-numeric, non-integer, and non-positive segments', () => {
    expect(readComparePair('/compare/abc/456')).toBeNull();
    expect(readComparePair('/compare/1.5/456')).toBeNull();
    expect(readComparePair('/compare/0/456')).toBeNull();
    expect(readComparePair('/compare/123/-4')).toBeNull();
  });
});
