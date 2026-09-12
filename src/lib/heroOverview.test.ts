import { describe, it, expect } from 'vitest';
import {
  buildPhases,
  duoRows,
  expectedWinRate,
  matchupRows,
  mergeMatchups,
  phaseCandidates,
  readingTheNumbers,
} from './heroOverview';
import type { HeroSummary, ItemStat, MatchupEntry } from '../types/api';

const hero = (hero_id: number, hero_name: string, win_rate: number | null): HeroSummary => ({
  hero_id,
  hero_name,
  icon_url: null,
  picks: 100,
  win_rate,
  avg_kills: null,
  avg_deaths: null,
  avg_assists: null,
  avg_net_worth: null,
  avg_duration_s: null,
});

const roster = new Map([
  [1, hero(1, 'Abrams', 50)],
  [2, hero(2, 'Bebop', 60)],
]);

const item = (id: number, avgS: number | null, matches: number, wr = 51): ItemStat =>
  ({ item_id: id, item_name: `Item ${id}`, icon_url: null, avg_buy_time_s: avgS, matches, win_rate: wr }) as ItemStat;

describe('mergeMatchups — the unbanded route serves two rows per opponent', () => {
  it('folds both sides into one row and recomputes the rate from the totals', () => {
    const rows: MatchupEntry[] = [
      { hero_b_id: 1, matches: 100, hero_a_wins: 60, win_rate: 0.6 },
      { hero_b_id: 1, matches: 300, hero_a_wins: 120, win_rate: 0.4 },
    ];
    expect(mergeMatchups(rows)).toEqual([{ opponentId: 1, matches: 400, wins: 180, winRate: 45 }]);
  });

  it('leaves a single-row (banded) payload untouched', () => {
    const rows: MatchupEntry[] = [{ hero_b_id: 2, matches: 50, hero_a_wins: 30, win_rate: 0.6 }];
    expect(mergeMatchups(rows)).toEqual([{ opponentId: 2, matches: 50, wins: 30, winRate: 60 }]);
  });

  it('never divides by zero', () => {
    expect(mergeMatchups([{ hero_b_id: 3, matches: 0, hero_a_wins: 0, win_rate: 0 }])[0]?.winRate).toBe(0);
  });
});

describe('expectedWinRate — log5 baseline', () => {
  it('is 50% between two equally strong heroes', () => {
    expect(expectedWinRate(55, 55)).toBeCloseTo(50, 6);
  });
  it('favours the stronger hero', () => {
    expect(expectedWinRate(60, 40) as number).toBeGreaterThan(60);
  });
  it('returns null rather than a fabricated baseline for an impossible rate', () => {
    expect(expectedWinRate(0, 50)).toBeNull();
    expect(expectedWinRate(100, 50)).toBeNull();
  });
});

describe('matchupRows', () => {
  it('sorts best-first and carries the delta against the expected rate', () => {
    const rows = matchupRows(
      [
        { opponentId: 1, matches: 100, wins: 45, winRate: 45 },
        { opponentId: 2, matches: 100, wins: 55, winRate: 55 },
      ],
      50,
      roster,
    );
    expect(rows.map((r) => r.name)).toEqual(['Bebop', 'Abrams']);
    //Expected vs a 50% hero is 50%, so the delta is the raw gap.
    expect(rows[1]?.delta).toBeCloseTo(-5, 6);
    //Bebop wins 60% overall, so beating it 55% of the time is better than expected.
    expect(rows[0]?.delta as number).toBeGreaterThan(0);
  });

  it('leaves the delta null when an overall rate is missing, never zero', () => {
    const rows = matchupRows([{ opponentId: 9, matches: 10, wins: 5, winRate: 50 }], 50, new Map());
    expect(rows[0]?.delta).toBeNull();
    expect(rows[0]?.name).toBe('Hero 9');
  });
});

describe('duoRows', () => {
  it('resolves the partner from either id column and drops the self row', () => {
    const rows = duoRows(
      [
        { hero_id1: 1, hero_id2: 7, wins: 60, matches_played: 100 },
        { hero_id1: 2, hero_id2: 7, wins: 40, matches_played: 100 },
        { hero_id1: 7, hero_id2: 7, wins: 1, matches_played: 1 },
      ],
      7,
      50,
      roster,
    );
    expect(rows.map((r) => r.partnerId)).toEqual([1, 2]);
    expect(rows[0]?.winRate).toBe(60);
  });

  it('drops a zero-match pairing', () => {
    expect(duoRows([{ hero_id1: 1, hero_id2: 7, wins: 0, matches_played: 0 }], 7, 50, roster)).toEqual([]);
  });
});

describe('phase bands', () => {
  const rows = [item(1, 300, 900), item(2, 400, 800), item(3, 900, 700), item(4, 1500, 600)];

  it('shortlists the most-bought rows inside each band', () => {
    expect(phaseCandidates(rows, 1).map((r) => r.item_id).sort()).toEqual([1, 3, 4]);
  });

  it('bands and renders on the same minute, so no row sits outside its own band', () => {
    const minutes = new Map([
      [1, 4],
      [2, 11],
      [3, 15],
      [4, 30],
    ]);
    const phases = buildPhases(rows, () => 'Weapon · I', (r) => minutes.get(r.item_id) ?? null);
    expect(phases.map((p) => p.items.map((i) => i.itemId))).toEqual([[1], [2, 3], [4]]);
    for (const p of phases) {
      for (const i of p.items) expect(i.minute).toBeGreaterThanOrEqual(p.from);
    }
  });

  it('omits an item with no resolved minute rather than banding it at zero', () => {
    const phases = buildPhases(rows, () => '', () => null);
    expect(phases.every((p) => p.items.length === 0)).toBe(true);
  });

  it('caps each phase', () => {
    const many = [1, 2, 3, 4, 5, 6].map((n) => item(n, 120, 100 - n));
    const phases = buildPhases(many, () => '', () => 5, 4);
    expect(phases[0]?.items).toHaveLength(4);
  });
});

describe('readingTheNumbers', () => {
  it('writes only sentences whose figures exist', () => {
    const out = readingTheNumbers({
      heroName: 'Haze',
      winRate: 52.5,
      patchRank: 1,
      rosterSize: 38,
      worstMatchups: [],
      bestDuo: null,
      topWinRateItem: null,
      mostBoughtItem: null,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('#1 of 38');
  });

  it('names every worst matchup it lists', () => {
    const out = readingTheNumbers({
      heroName: 'Haze',
      winRate: null,
      patchRank: null,
      rosterSize: 38,
      worstMatchups: [
        { name: 'Dynamo', winRate: 47 },
        { name: 'Kelvin', winRate: 46 },
      ],
      bestDuo: null,
      topWinRateItem: null,
      mostBoughtItem: null,
    });
    expect(out[0]).toContain('Dynamo and Kelvin');
    expect(out[0]).toContain('46.0%');
  });
});
