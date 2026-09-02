import { describe, expect, it } from 'vitest';
import { GENERIC_MATCH_TITLE, matchPageTitle } from './matchTitle';
import type { MatchDetail, MatchPlayerDetail } from '../types/api';

function player(team: number, kills: number, account_id: number): MatchPlayerDetail {
  return {
    account_id,
    steam_name: `p${account_id}`,
    hero_id: 1,
    hero_name: 'Hero',
    icon_url: null,
    team,
    winner: false,
    kills,
    deaths: 0,
    assists: 0,
    net_worth: 1000 * account_id,
    last_hits: 0,
    denies: 0,
    damage_dealt: 0,
    damage_taken: 0,
    badge: 0,
  };
}

function match(over: Partial<MatchDetail> = {}): MatchDetail {
  return {
    match_id: 103213386,
    start_time: '2026-09-02T09:13:02Z',
    duration_s: 359,
    match_mode: 'Ranked',
    game_mode: 'Normal',
    average_badge_team0: 0,
    average_badge_team1: 0,
    winning_team: 0,
    players: [player(0, 8, 1), player(0, 5, 2), player(1, 1, 3), player(1, 0, 4)],
    ...over,
  };
}

describe('matchPageTitle', () => {
  it('sums team kills into an Amber-then-Sapphire score with the winner', () => {
    expect(matchPageTitle(match())).toBe('Match #103213386 — Amber 13–1 Sapphire, Amber win');
  });

  it('names Sapphire when it won', () => {
    expect(matchPageTitle(match({ winning_team: 1 }))).toBe('Match #103213386 — Amber 13–1 Sapphire, Sapphire win');
  });

  it('omits the result when the winner is unknown', () => {
    expect(matchPageTitle(match({ winning_team: null }))).toBe('Match #103213386 — Amber 13–1 Sapphire');
  });

  it('titles by the served match_id, not a caller-supplied one', () => {
    expect(matchPageTitle(match({ match_id: 42 }))).toBe('Match #42 — Amber 13–1 Sapphire, Amber win');
  });

  it('falls back when the fetch missed', () => {
    expect(matchPageTitle(null)).toBe(GENERIC_MATCH_TITLE);
    expect(matchPageTitle(undefined)).toBe(GENERIC_MATCH_TITLE);
  });

  it('falls back on an empty or one-sided roster', () => {
    expect(matchPageTitle(match({ players: [] }))).toBe(GENERIC_MATCH_TITLE);
    expect(matchPageTitle(match({ players: [player(0, 8, 1)] }))).toBe(GENERIC_MATCH_TITLE);
  });

  it('scores a shutout as 0 rather than falling back', () => {
    const shutout = match({ players: [player(0, 4, 1), player(1, 0, 3)], winning_team: 0 });
    expect(matchPageTitle(shutout)).toBe('Match #103213386 — Amber 4–0 Sapphire, Amber win');
  });
});
