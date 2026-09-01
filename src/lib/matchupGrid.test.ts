import { describe, it, expect } from 'vitest';
import {
  counterRows,
  defaultBucketForBadge,
  matchupWindowHi,
  panelState,
  topPlayedHeroes,
  HERO_MATCHUPS_DATASET,
  type HeroCardInput,
  type QueryLike,
} from './matchupGrid';
import { ApiError } from './apiClient';
import type { DataHorizonResponse, HeroPlayed, HeroSummary, MatchupEntry } from '../types/api';

const summary = (hero_id: number, hero_name: string, icon_url: string | null): HeroSummary => ({
  hero_id,
  hero_name,
  icon_url,
  picks: 0,
  win_rate: null,
  avg_kills: null,
  avg_deaths: null,
  avg_assists: null,
  avg_net_worth: null,
  avg_duration_s: null,
});
const roster = new Map<number, HeroSummary>([
  [6, summary(6, 'Abrams', '/a.png')],
  [1, summary(1, 'Infernus', null)],
]);
const entry = (hero_b_id: number, win_rate: number, matches = 1000): MatchupEntry => ({
  hero_b_id,
  matches,
  hero_a_wins: Math.round(matches * win_rate),
  win_rate,
});

describe('counterRows — a hero’s worst matchups', () => {
  it('sorts win_rate ascending (lowest = the counter) and takes n', () => {
    const rows = counterRows([entry(6, 0.52), entry(1, 0.41), entry(99, 0.48)], roster, 2);
    expect(rows.map((r) => r.heroBId)).toEqual([1, 99]);
  });
  it('normalizes a 0..1 fraction to 0-100 and passes an already-percent value through', () => {
    expect(counterRows([entry(6, 0.4361)], roster)[0]?.wrPct).toBeCloseTo(43.61, 2);
    expect(counterRows([entry(6, 55)], roster)[0]?.wrPct).toBe(55);
  });
  it('falls back to "Hero {id}" + null icon for an unmapped opponent, carries the roster name+icon otherwise', () => {
    expect(counterRows([entry(99, 0.3)], roster)[0]).toMatchObject({ name: 'Hero 99', iconUrl: null });
    expect(counterRows([entry(6, 0.3)], roster)[0]).toMatchObject({ name: 'Abrams', iconUrl: '/a.png', matches: 1000 });
  });
});

describe('defaultBucketForBadge — the selector opens on the player’s own rank', () => {
  it('maps a badge tier to the ITEM_BUCKETS entry spanning it', () => {
    expect(defaultBucketForBadge(13)).toBe(1); //tier 1 Initiate -> Initiate-Alchemist
    expect(defaultBucketForBadge(64)).toBe(3); //tier 6 Emissary -> Emissary-Archon
    expect(defaultBucketForBadge(115)).toBe(5); //tier 11 Eternus -> Ascendant-Eternus
  });
  it('falls back to 0 (All ranks) for an unknown badge or a tier no bucket spans', () => {
    expect(defaultBucketForBadge(null)).toBe(0);
    expect(defaultBucketForBadge(undefined)).toBe(0);
    expect(defaultBucketForBadge(5)).toBe(0); //tier 0 Obscurus — spanned by no bucket
  });
});

describe('matchupWindowHi — the honest data-through bound', () => {
  const horizon = (over: Partial<DataHorizonResponse> = {}): DataHorizonResponse => ({
    max_match_start_time: '2026-08-23T00:00:00Z',
    datasets: [
      { dataset: HERO_MATCHUPS_DATASET, window_lo: '2026-05-01T00:00:00Z', window_hi: '2026-06-11T00:00:00Z', computed_at: null },
    ],
    ...over,
  });
  it('returns the hero-matchups window_hi', () => {
    expect(matchupWindowHi(horizon())).toBe('2026-06-11T00:00:00Z');
  });
  it('is null when the horizon, the dataset entry, or the bound is absent', () => {
    expect(matchupWindowHi(undefined)).toBeNull();
    expect(matchupWindowHi(null)).toBeNull();
    expect(matchupWindowHi(horizon({ datasets: [] }))).toBeNull();
    expect(
      matchupWindowHi(horizon({ datasets: [{ dataset: HERO_MATCHUPS_DATASET, window_lo: 'x', window_hi: null, computed_at: null }] })),
    ).toBeNull();
  });
});

describe('topPlayedHeroes', () => {
  const played: HeroPlayed[] = [
    { hero_id: 1, hero_name: 'A', matches_played: 10, last_played: '' },
    { hero_id: 2, hero_name: 'B', matches_played: 80, last_played: '' },
    { hero_id: 3, hero_name: 'C', matches_played: 40, last_played: '' },
    { hero_id: 4, hero_name: 'D', matches_played: 5, last_played: '' },
  ];
  it('sorts by matches_played desc and takes 3', () => {
    expect(topPlayedHeroes(played).map((h) => h.hero_id)).toEqual([2, 3, 1]);
  });
  it('is empty for a player with no played heroes', () => {
    expect(topPlayedHeroes(undefined)).toEqual([]);
    expect(topPlayedHeroes([])).toEqual([]);
  });
});

//The design's 8-row empty-state matrix, one classification per row.
describe('panelState — empty-state matrix (rows 1–8)', () => {
  const hero: HeroPlayed = { hero_id: 6, hero_name: 'Abrams', matches_played: 100, last_played: '' };
  const pending = <T,>(): QueryLike<T> => ({ isPending: true, isError: false });
  const ok = <T,>(data: T): QueryLike<T> => ({ isPending: false, isError: false, data });
  const fail = <T,>(error: unknown): QueryLike<T> => ({ isPending: false, isError: true, error });
  const card = (query: QueryLike<MatchupEntry[]>): HeroCardInput => ({ hero, query });

  it('row 1 — panel loading while heroes-played is pending', () => {
    expect(panelState(pending<HeroPlayed[]>(), [], roster).kind).toBe('loading');
  });
  it('row 2 — panel error when heroes-played errors', () => {
    expect(panelState(fail<HeroPlayed[]>(new ApiError(404, 'u', 'x')), [], roster).kind).toBe('error');
  });
  it('row 3 — panel empty when the player has no played heroes', () => {
    expect(panelState(ok<HeroPlayed[]>([]), [], roster).kind).toBe('empty');
  });
  it('rows 4–8 — each card resolves off its own matchup query', () => {
    const st = panelState(
      ok<HeroPlayed[]>([hero]),
      [
        card(pending<MatchupEntry[]>()), //4 loading
        card(fail<MatchupEntry[]>(new ApiError(202, 'u', 'x'))), //5 computing
        card(fail<MatchupEntry[]>(new ApiError(501, 'u', 'x'))), //6 disabled
        card(ok<MatchupEntry[]>([])), //7 empty (200 [])
        card(fail<MatchupEntry[]>(new ApiError(500, 'u', 'x'))), //8 other error
        card(ok<MatchupEntry[]>([entry(1, 0.4)])), //rows
      ],
      roster,
    );
    expect(st.kind).toBe('cards');
    if (st.kind !== 'cards') return;
    expect(st.cards.map((c) => c.kind)).toEqual(['loading', 'computing', 'disabled', 'empty', 'error', 'rows']);
  });
});
