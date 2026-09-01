//Page math + server params for the /matches pager (?page=, offset paging) — pure, unit-tested.
//"unranked" maps to the literal match_mode=Unranked server filter (live rows are always
//Ranked/Unranked, so it matches the old client-side not-Ranked filter).
import { slugToGameMode, type MatchesModeSlug } from './matchesMode';
import type { RankedFilter } from './matchesRanked';

export const MATCHES_PAGE_SIZE = 50;

//Backend clamps ?offset= at 100k (the leaderboard's hostile-offset guard) — the pager stops there.
export const MATCHES_MAX_OFFSET = 100_000;
export const MATCHES_LAST_PAGE = Math.floor(MATCHES_MAX_OFFSET / MATCHES_PAGE_SIZE) + 1;

export function pageFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get('page');
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function offsetFromPage(page: number): number {
  return (page - 1) * MATCHES_PAGE_SIZE;
}

export function lastPage(total: number | null): number | null {
  if (total === null) return null;
  return Math.min(Math.max(1, Math.ceil(total / MATCHES_PAGE_SIZE)), MATCHES_LAST_PAGE);
}

export function pagerWindow(current: number, last: number): number[] {
  const preliminary = Math.max(1, current - 2);
  const end = Math.min(last, preliminary + 4);
  const start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export type RecentMatchesParams = {
  limit: number;
  offset?: number;
  game_mode?: string;
  match_mode?: string;
};

//Page 1 omits offset so the island's default queryKey matches the SSG seed byte for byte.
export function recentMatchesParams(
  page: number,
  slug: MatchesModeSlug,
  ranked: RankedFilter,
): RecentMatchesParams {
  const offset = offsetFromPage(page);
  const game_mode = slugToGameMode(slug);
  const match_mode = ranked === 'ranked' ? 'Ranked' : ranked === 'unranked' ? 'Unranked' : undefined;
  return {
    limit: MATCHES_PAGE_SIZE,
    ...(offset > 0 ? { offset } : {}),
    ...(game_mode ? { game_mode } : {}),
    ...(match_mode ? { match_mode } : {}),
  };
}
