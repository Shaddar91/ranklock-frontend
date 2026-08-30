import { describe, expect, it } from 'vitest';
import { filterMatchRows, gameModeLabel, isRanked, slugToGameMode } from './matchesMode';
import type { MatchRow } from '../types/api';

describe('slugToGameMode — toggle slug to API game_mode param', () => {
  it('normal → Normal', () => expect(slugToGameMode('normal')).toBe('Normal'));
  it('brawl → StreetBrawl', () => expect(slugToGameMode('brawl')).toBe('StreetBrawl'));
  it('all → undefined (no filter sent to API)', () => expect(slugToGameMode('all')).toBeUndefined());
});

describe('gameModeLabel — chip label from game_mode', () => {
  it('Normal → "Normal"', () => expect(gameModeLabel('Normal')).toBe('Normal'));
  it('StreetBrawl → "Brawl"', () => expect(gameModeLabel('StreetBrawl')).toBe('Brawl'));
  it('null → null', () => expect(gameModeLabel(null)).toBeNull());
  it('unknown value → null', () => expect(gameModeLabel('CoopBot')).toBeNull());
});

describe('isRanked — Ranked chip condition', () => {
  it('true for Ranked', () => expect(isRanked('Ranked')).toBe(true));
  it('false for Unranked', () => expect(isRanked('Unranked')).toBe(false));
  it('false for null', () => expect(isRanked(null)).toBe(false));
  it('false for other values', () => expect(isRanked('PrivateLobby')).toBe(false));
});

describe('filterMatchRows — client-side /matches toggle filter', () => {
  const base: MatchRow = {
    match_id: 0,
    start_time: '',
    duration_s: 0,
    match_mode: 'Unranked',
    game_mode: null,
    average_badge_team0: null,
    average_badge_team1: null,
    winning_team: null,
  };
  const normal: MatchRow = { ...base, match_id: 1, game_mode: 'Normal' };
  const brawl: MatchRow = { ...base, match_id: 2, game_mode: 'StreetBrawl' };
  const unknown: MatchRow = { ...base, match_id: 3, game_mode: null };
  const rows = [normal, brawl, unknown];

  it('all → returns every row unchanged', () => {
    expect(filterMatchRows(rows, 'all')).toHaveLength(3);
  });

  it('normal → only Normal rows', () => {
    const result = filterMatchRows(rows, 'normal');
    expect(result.map((r) => r.match_id)).toEqual([1]);
  });

  it('brawl → only StreetBrawl rows', () => {
    const result = filterMatchRows(rows, 'brawl');
    expect(result.map((r) => r.match_id)).toEqual([2]);
  });

  it('normal on an empty list → empty list', () => {
    expect(filterMatchRows([], 'normal')).toHaveLength(0);
  });
});
