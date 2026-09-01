//Pure helpers for the profile MatchupsPanel: served /heroes/{id}/matchups rows →
//"who counters your hero" rows + empty-state classification. Node-testable, no I/O.
import type { DataHorizonResponse, HeroPlayed, HeroSummary, MatchupEntry } from '../types/api';
import { ITEM_BUCKETS } from './brackets';
import { rankFromBadge } from './ranks';
import { isComputing, isDisabled } from './apiClient';

export const HERO_MATCHUPS_DATASET = 'hero-matchups';

export interface CounterRow {
  heroBId: number;
  name: string;
  iconUrl: string | null;
  wrPct: number;
  matches: number;
}

//A hero's counters = its worst matchups: win_rate ascending, take n; 0..1 fraction
//normalized to 0-100 as on the hero page (an already-percent value passes through).
export function counterRows(
  entries: MatchupEntry[],
  heroById: Map<number, HeroSummary>,
  n = 5,
): CounterRow[] {
  return [...entries]
    .sort((a, b) => a.win_rate - b.win_rate)
    .slice(0, n)
    .map((e) => {
      const hero = heroById.get(e.hero_b_id);
      return {
        heroBId: e.hero_b_id,
        name: hero?.hero_name ?? `Hero ${e.hero_b_id}`,
        iconUrl: hero?.icon_url ?? null,
        wrPct: e.win_rate <= 1 ? e.win_rate * 100 : e.win_rate,
        matches: e.matches,
      };
    });
}

//The bracket the selector opens on: the player's own rank bucket. Unknown badge or
//a tier no bucket spans (Obscurus) → 0 = All ranks.
export function defaultBucketForBadge(badge: number | null | undefined): number {
  const tier = rankFromBadge(badge)?.tier;
  if (tier == null) return 0;
  const bucket = ITEM_BUCKETS.find((b) => b.tiers.includes(tier));
  return typeof bucket?.key === 'number' ? bucket.key : 0;
}

//The fold's upper window bound for the "Data through {date}" line; null → no date.
export function matchupWindowHi(horizon: DataHorizonResponse | null | undefined): string | null {
  return horizon?.datasets?.find((d) => d.dataset === HERO_MATCHUPS_DATASET)?.window_hi ?? null;
}

export function topPlayedHeroes(heroesPlayed: HeroPlayed[] | undefined, n = 3): HeroPlayed[] {
  return [...(heroesPlayed ?? [])].sort((a, b) => b.matches_played - a.matches_played).slice(0, n);
}

//What panelState reads off a query result, declared structurally so it stays pure.
export interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  data?: T;
}

export interface HeroCardInput {
  hero: HeroPlayed;
  query: QueryLike<MatchupEntry[]>;
}

export type CardState =
  | { kind: 'loading'; hero: HeroPlayed }
  | { kind: 'computing'; hero: HeroPlayed; error: unknown }
  | { kind: 'disabled'; hero: HeroPlayed; error: unknown }
  | { kind: 'error'; hero: HeroPlayed; error: unknown }
  | { kind: 'empty'; hero: HeroPlayed }
  | { kind: 'rows'; hero: HeroPlayed; rows: CounterRow[] };

export type PanelState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'empty' }
  | { kind: 'cards'; cards: CardState[] };

function cardState(input: HeroCardInput, heroById: Map<number, HeroSummary>, n: number): CardState {
  const { hero, query } = input;
  if (query.isPending) return { kind: 'loading', hero };
  if (query.isError) {
    if (isComputing(query.error)) return { kind: 'computing', hero, error: query.error };
    if (isDisabled(query.error)) return { kind: 'disabled', hero, error: query.error };
    return { kind: 'error', hero, error: query.error };
  }
  const rows = counterRows(query.data ?? [], heroById, n);
  return rows.length === 0 ? { kind: 'empty', hero } : { kind: 'rows', hero, rows };
}

//The whole empty-state matrix as one pure function: panel loads/errors/empties on
//heroes-played, then each card resolves off its own matchup query.
export function panelState(
  heroesPlayed: QueryLike<HeroPlayed[]>,
  cards: HeroCardInput[],
  heroById: Map<number, HeroSummary>,
  n = 5,
): PanelState {
  if (heroesPlayed.isPending) return { kind: 'loading' };
  if (heroesPlayed.isError) return { kind: 'error', error: heroesPlayed.error };
  if ((heroesPlayed.data?.length ?? 0) === 0) return { kind: 'empty' };
  return { kind: 'cards', cards: cards.map((c) => cardState(c, heroById, n)) };
}
