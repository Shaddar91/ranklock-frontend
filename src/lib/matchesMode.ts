//Helpers for match-mode chip labels and client-side row filtering on /matches.
import type { MatchRow } from '../types/api';

export type MatchesModeSlug = 'normal' | 'brawl' | 'all';

export function slugToGameMode(slug: MatchesModeSlug): string | undefined {
  if (slug === 'brawl') return 'StreetBrawl';
  if (slug === 'normal') return 'Normal';
  return undefined;
}

export function gameModeLabel(game_mode: string | null): string | null {
  if (game_mode === 'Normal') return 'Normal';
  if (game_mode === 'StreetBrawl') return 'Brawl';
  return null;
}

export function isRanked(match_mode: string | null): boolean {
  return match_mode === 'Ranked';
}

export function filterMatchRows(rows: MatchRow[], slug: MatchesModeSlug): MatchRow[] {
  if (slug === 'all') return rows;
  const target = slugToGameMode(slug);
  return rows.filter((r) => r.game_mode === target);
}
