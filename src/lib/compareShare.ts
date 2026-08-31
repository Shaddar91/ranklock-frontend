//Canonical /compare/{me}/{vs} share URL + pair reader. The active tab selection
//(hero + the two mode axes) rides the URL so a pasted link reopens the same view
//AND the OG card mirrors it; defaults (all-heroes/Normal/Unranked) stay omitted.
import { SITE_ORIGIN } from './seo';
import { MATCH_MODE_PARAM, matchModeToParam } from './matchMode';
import type { GameMode, MatchMode } from '../types/api';

export interface CompareSelection {
  hero_id?: number;
  game_mode?: GameMode;
  match_mode?: MatchMode;
}

export const COMPARE_HERO_PARAM = 'hero';
export const COMPARE_MODE_PARAM = 'mode';
//?mode=brawl mirrors useGameMode's slug (Normal is the default → omitted).
const GAME_MODE_SLUG: Partial<Record<GameMode, string>> = { StreetBrawl: 'brawl' };

//The non-default parts of a selection as a query string ('' when all-default).
//Insertion order is fixed (hero, mode, ranked) so the emitted URL is stable.
export function compareSelectionQuery(sel?: CompareSelection): string {
  if (!sel) return '';
  const q = new URLSearchParams();
  if (sel.hero_id && sel.hero_id > 0) q.set(COMPARE_HERO_PARAM, String(sel.hero_id));
  const slug = sel.game_mode ? GAME_MODE_SLUG[sel.game_mode] : undefined;
  if (slug) q.set(COMPARE_MODE_PARAM, slug);
  const ranked = sel.match_mode ? matchModeToParam(sel.match_mode) : null;
  if (ranked) q.set(MATCH_MODE_PARAM, ranked);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function compareSharePath(me: number, vs: number, sel?: CompareSelection): string {
  return `/compare/${me}/${vs}/${compareSelectionQuery(sel)}`;
}

export function compareShareUrl(me: number, vs: number, sel?: CompareSelection): string {
  return `${SITE_ORIGIN}${compareSharePath(me, vs, sel)}`;
}

//readNumericId's tolerance (locale prefix, trailing junk); both ids must be positive ints.
export function readComparePair(pathname: string): { a: number; b: number } | null {
  const m = pathname.match(/\/compare\/([^/?#]+)\/([^/?#]+)/);
  if (!m || m[1] == null || m[2] == null) return null;
  const a = Number(decodeURIComponent(m[1]));
  const b = Number(decodeURIComponent(m[2]));
  const ok = (n: number) => Number.isFinite(n) && Number.isInteger(n) && n > 0;
  return ok(a) && ok(b) ? { a, b } : null;
}
