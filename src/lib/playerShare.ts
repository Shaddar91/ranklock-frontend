//Canonical /players/{id} share URL + its OG card URL: the on-screen selection (frozen window,
//hero, league, metric, mode) rides the query so a reopened link and the card both mirror it.
import { SITE_ORIGIN } from './seo';
import { MATCH_MODE_PARAM, matchModeToParam } from './matchMode';
import { slugOf } from './heroSlugs';
import type { CurveMetric, SigView } from './curveScope';
import type { GameMode, MatchMode } from '../types/api';

export interface PlayerShareSelection {
  hero_id?: number;
  from?: string;
  to?: string;
  metric?: CurveMetric;
  view?: SigView;
  league?: number | null;
  game_mode?: GameMode;
  match_mode?: MatchMode;
}

export const PLAYER_HERO_PARAM = 'hero';
export const PLAYER_FROM_PARAM = 'from';
export const PLAYER_TO_PARAM = 'to';
export const PLAYER_METRIC_PARAM = 'metric';
export const PLAYER_VIEW_PARAM = 'view';
export const PLAYER_LEAGUE_PARAM = 'league';
export const PLAYER_MODE_PARAM = 'mode';
const GAME_MODE_SLUG: Partial<Record<GameMode, string>> = { StreetBrawl: 'brawl' };

//Stable insertion order; an unpinned hero is DROPPED rather than emit an unresolvable slug.
export function playerSelectionQuery(sel?: PlayerShareSelection): string {
  if (!sel) return '';
  const q = new URLSearchParams();
  const slug = sel.hero_id && sel.hero_id > 0 ? slugOf(sel.hero_id) : null;
  if (slug) q.set(PLAYER_HERO_PARAM, slug);
  if (sel.from) q.set(PLAYER_FROM_PARAM, sel.from);
  if (sel.to) q.set(PLAYER_TO_PARAM, sel.to);
  if (sel.metric && sel.metric !== 'souls') q.set(PLAYER_METRIC_PARAM, sel.metric);
  if (sel.view && sel.view !== 'gap') q.set(PLAYER_VIEW_PARAM, sel.view);
  if (sel.league !== undefined) q.set(PLAYER_LEAGUE_PARAM, sel.league === null ? 'all' : String(sel.league));
  const modeSlug = sel.game_mode ? GAME_MODE_SLUG[sel.game_mode] : undefined;
  if (modeSlug) q.set(PLAYER_MODE_PARAM, modeSlug);
  const ranked = sel.match_mode ? matchModeToParam(sel.match_mode) : null;
  if (ranked) q.set(MATCH_MODE_PARAM, ranked);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function playerSharePath(id: number, sel?: PlayerShareSelection): string {
  return `/players/${id}/${playerSelectionQuery(sel)}`;
}

export function playerShareUrl(id: number, sel?: PlayerShareSelection): string {
  return `${SITE_ORIGIN}${playerSharePath(id, sel)}`;
}

export const OG_CARD_ORIGIN = 'https://og.ranklock.app';

export function playerCardUrl(id: number, sel?: PlayerShareSelection): string {
  return `${OG_CARD_ORIGIN}/og/player/${id}.png${playerSelectionQuery(sel)}`;
}

//A relative window would render different data whenever a shared link is reopened, so freeze
//it to an absolute [from, to]; only "days" has a clean calendar equivalent to freeze.
export function resolveFrozenWindow(kind: 'games' | 'days', n: number | 'all', now: Date = new Date()): { from?: string; to?: string } {
  if (kind !== 'days' || n === 'all') return {};
  const from = new Date(now.getTime() - n * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(now) };
}
