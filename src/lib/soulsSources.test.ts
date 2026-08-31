import { describe, it, expect } from 'vitest';
import {
  SOULS_GROUPS,
  SOULS_STACK_GROUPS,
  buildSoulsSourceSeries,
  displaySign,
  hasCohortSouls,
  isPlayerSoulsEmpty,
  soulsKey,
} from './soulsSources';
import type { PlayerSoulsResponse, SoulsCohortResponse } from '../types/api';

//Buckets are 180s apart, so t_seconds = minute_bucket*180 and the game minute = bucket*3. souls_avg
//is already REAL souls (the backend divides by the denominator), so the builder passes it through
//verbatim — only losses are negated for the below-zero line.
const cPt = (bucket: number, souls_avg: number, player_count = 100) => ({
  minute_bucket: bucket,
  t_seconds: bucket * 180,
  souls_avg,
  player_count,
});
const pPt = (bucket: number, souls_avg: number, matches = 20) => ({
  minute_bucket: bucket,
  t_seconds: bucket * 180,
  souls_avg,
  matches,
});
const cohort = (groups: Record<string, ReturnType<typeof cPt>[]>): SoulsCohortResponse => ({
  band: 7,
  match_mode: 'Unranked',
  groups: Object.entries(groups).map(([souls_group, points]) => ({ souls_group, points })),
});
const player = (
  groups: Record<string, ReturnType<typeof pPt>[]>,
  player_hero_games?: number,
): PlayerSoulsResponse => ({
  account_id: 1,
  hero_id: null,
  match_mode: 'Unranked',
  groups: Object.entries(groups).map(([souls_group, points]) => ({ souls_group, points })),
  ...(player_hero_games === undefined ? {} : { player_hero_games }),
});

describe('souls group contract', () => {
  it('matches the backend SOULS_GROUPS order (souls_sources.rs) — five stackers then losses', () => {
    expect(SOULS_GROUPS).toEqual(['lane_creeps', 'neutrals', 'heroes', 'objectives', 'denies', 'losses']);
    expect(SOULS_STACK_GROUPS).toEqual(['lane_creeps', 'neutrals', 'heroes', 'objectives', 'denies']);
  });

  it('losses are the only negative source; every other group is additive', () => {
    expect(displaySign('losses')).toBe(-1);
    for (const g of SOULS_STACK_GROUPS) expect(displaySign(g)).toBe(1);
  });

  it('no user-visible identifier says gold', () => {
    expect(SOULS_GROUPS.join(' ')).not.toMatch(/gold/i);
  });
});

describe('buildSoulsSourceSeries', () => {
  it('keys each side/group as `${side}_${group}` on the union minute grid', () => {
    const rows = buildSoulsSourceSeries(
      player({ heroes: [pPt(1, 500), pPt(2, 900)] }),
      cohort({ heroes: [cPt(1, 400), cPt(2, 800)] }),
    );
    expect(rows.map((r) => r.min)).toEqual([3, 6]);
    expect(rows[0]![soulsKey('you', 'heroes')]).toBe(500);
    expect(rows[0]![soulsKey('tier', 'heroes')]).toBe(400);
    expect(rows[1]![soulsKey('you', 'heroes')]).toBe(900);
    expect(rows[1]![soulsKey('tier', 'heroes')]).toBe(800);
  });

  it('negates losses so they sit below zero, leaving the five stack sources positive', () => {
    const rows = buildSoulsSourceSeries(
      player({ lane_creeps: [pPt(1, 1200)], losses: [pPt(1, 300)] }),
      null,
    );
    expect(rows[0]![soulsKey('you', 'lane_creeps')]).toBe(1200);
    expect(rows[0]![soulsKey('you', 'losses')]).toBe(-300);
  });

  it('builds a union grid — a side/group with no sample at a minute omits its key (a gap, not a 0)', () => {
    const rows = buildSoulsSourceSeries(
      player({ heroes: [pPt(1, 500)] }),
      cohort({ heroes: [cPt(2, 800)] }),
    );
    expect(rows.map((r) => r.min)).toEqual([3, 6]);
    //you has min 3 only; tier has min 6 only — neither fabricates the other minute
    expect(rows[0]![soulsKey('you', 'heroes')]).toBe(500);
    expect(soulsKey('tier', 'heroes') in rows[0]!).toBe(false);
    expect(soulsKey('you', 'heroes') in rows[1]!).toBe(false);
    expect(rows[1]![soulsKey('tier', 'heroes')]).toBe(800);
  });

  it('sorts minutes ascending regardless of point/group input order', () => {
    const rows = buildSoulsSourceSeries(
      player({ denies: [pPt(3, 90), pPt(1, 30)], neutrals: [pPt(2, 200)] }),
      null,
    );
    expect(rows.map((r) => r.min)).toEqual([3, 6, 9]);
  });

  it('renders the tier alone while the player line is still folding (and vice versa)', () => {
    const tierOnly = buildSoulsSourceSeries(player({}), cohort({ objectives: [cPt(1, 700)] }));
    expect(tierOnly).toHaveLength(1);
    expect(tierOnly[0]![soulsKey('tier', 'objectives')]).toBe(700);
    expect(soulsKey('you', 'objectives') in tierOnly[0]!).toBe(false);

    const youOnly = buildSoulsSourceSeries(player({ objectives: [pPt(1, 650)] }), null);
    expect(youOnly[0]![soulsKey('you', 'objectives')]).toBe(650);
  });

  it('ignores a group the server adds that the panel does not render yet', () => {
    const rows = buildSoulsSourceSeries(player({ heroes: [pPt(1, 500)], secret_shop: [pPt(1, 999)] }), null);
    expect(rows[0]![soulsKey('you', 'heroes')]).toBe(500);
    expect('you_secret_shop' in rows[0]!).toBe(false);
  });

  it('drops a null souls_avg sample rather than plotting a fabricated point', () => {
    const rows = buildSoulsSourceSeries(
      player({ neutrals: [pPt(1, 100), { ...pPt(2, 0), souls_avg: null as unknown as number }] }),
      null,
    );
    expect(rows.map((r) => r.min)).toEqual([3]);
  });

  it('returns an empty grid when both sides are absent', () => {
    expect(buildSoulsSourceSeries(null, null)).toEqual([]);
    expect(buildSoulsSourceSeries(undefined, undefined)).toEqual([]);
  });
});

describe('isPlayerSoulsEmpty (honest per-player empty state)', () => {
  it('is empty for a missing response', () => {
    expect(isPlayerSoulsEmpty(null)).toBe(true);
    expect(isPlayerSoulsEmpty(undefined)).toBe(true);
  });

  it('is empty when ?hero= matched zero of the player games (player_hero_games === 0)', () => {
    expect(isPlayerSoulsEmpty(player({ heroes: [pPt(1, 500)] }, 0))).toBe(true);
  });

  it('is empty when every one of the six group series came back empty', () => {
    const allEmpty = player(Object.fromEntries(SOULS_GROUPS.map((g) => [g, []])));
    expect(isPlayerSoulsEmpty(allEmpty)).toBe(true);
  });

  it('is NOT empty once any group carries a folded point', () => {
    expect(isPlayerSoulsEmpty(player({ heroes: [pPt(1, 500)] }))).toBe(false);
    //a hero scope that DID match games (>0) with real points is not empty
    expect(isPlayerSoulsEmpty(player({ heroes: [pPt(1, 500)] }, 12))).toBe(false);
  });
});

describe('hasCohortSouls', () => {
  it('is true only when the tier has at least one folded point', () => {
    expect(hasCohortSouls(null)).toBe(false);
    expect(hasCohortSouls(cohort(Object.fromEntries(SOULS_GROUPS.map((g) => [g, []]))))).toBe(false);
    expect(hasCohortSouls(cohort({ lane_creeps: [cPt(1, 1000)] }))).toBe(true);
  });
});
