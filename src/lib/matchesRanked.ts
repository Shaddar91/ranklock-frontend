//URL<->3-state ranked filter (Any/Ranked/Unranked) for the /matches + profile recent-match lists.
//Pure, DOM-free, client-side (the list payload already carries match_mode); shares `?ranked=` with matchMode.ts.
import { MATCH_MODE_PARAM } from './matchMode';
import { isRanked } from './matchesMode';

export type RankedFilter = 'any' | 'ranked' | 'unranked';

export const DEFAULT_RANKED_FILTER: RankedFilter = 'any';
export const RANKED_FILTER_PARAM = MATCH_MODE_PARAM;

export function rankedFilterFromParam(raw: string | null | undefined): RankedFilter {
  if (raw == null) return DEFAULT_RANKED_FILTER;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'ranked') return 'ranked';
  if (v === '0' || v === 'false' || v === 'unranked') return 'unranked';
  return DEFAULT_RANKED_FILTER;
}

//Any stays out of the URL (default), so an absent param reads Unranked on the 2-state selector and Any here.
export function rankedFilterToParam(f: RankedFilter): string | null {
  if (f === 'ranked') return '1';
  if (f === 'unranked') return '0';
  return null;
}

export function filterRowsByRanked<T extends { match_mode: string | null }>(rows: T[], f: RankedFilter): T[] {
  if (f === 'ranked') return rows.filter((r) => isRanked(r.match_mode));
  if (f === 'unranked') return rows.filter((r) => !isRanked(r.match_mode));
  return rows;
}
