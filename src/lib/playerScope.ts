//Player compare scope — ONE {kind, n, hero_id} state shared by the radar and the
//Compare tab so solo shape and overlay read the SAME window + hero scope. Pure
//functions; the React state hook is player/usePlayerScope (URL-backed).
import { idOf } from './heroSlugs';

export type PlayerScopeKind = 'games' | 'days';

export interface PlayerScope {
  kind: PlayerScopeKind;
  n: number | 'all';
  hero_id: number;
}

export const DEFAULT_SCOPE: PlayerScope = { kind: 'games', n: 'all', hero_id: 0 };

export const SCOPE_KIND_PARAM = 'kind';
export const SCOPE_N_PARAM = 'n';
export const SCOPE_HERO_PARAM = 'hero';
export const SCOPE_CHANGE_EVENT = 'ranklock:playerscope';

//Switching kind resets n to this kind's own default (all/30) rather than remembering a
//per-kind last value.
const DAYS_DEFAULT = 30;
function defaultNFor(kind: PlayerScopeKind): number | 'all' {
  return kind === 'days' ? DAYS_DEFAULT : DEFAULT_SCOPE.n;
}

export function scopeKindFromParam(raw: string | null): PlayerScopeKind {
  return raw === 'days' ? 'days' : 'games';
}
export function scopeKindToParam(kind: PlayerScopeKind): string | null {
  return kind === 'games' ? null : kind;
}

export function scopeNFromParam(raw: string | null, kind: PlayerScopeKind): number | 'all' {
  if (raw == null) return defaultNFor(kind);
  if (raw === 'all') return 'all';
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : defaultNFor(kind);
}
export function scopeNToParam(n: number | 'all', kind: PlayerScopeKind): string | null {
  return n === defaultNFor(kind) ? null : String(n);
}

//Component 3's hero-name alias, mirrored client-side: a slug resolves through the pinned
//roster; anything unresolvable (or absent) is the all-heroes default, never a 400.
export function scopeHeroFromParam(raw: string | null): number {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return idOf(raw) ?? 0;
}
export function scopeHeroToParam(hero_id: number): string | null {
  return hero_id > 0 ? String(hero_id) : null;
}

export const SCOPE_PRESETS: Record<PlayerScopeKind, ReadonlyArray<number | 'all'>> = {
  games: [3, 10, 25, 50, 'all'],
  days: [3, 7, 30, 90],
};

//hero_id always sent (0 = all-heroes opt-in; a hero only on explicit select);
//'all' sends no window bound; the window keys never mix (the backend 400s both).
export function scopeParams(s: PlayerScope): { hero_id: number; last_games?: number; last_days?: number } {
  const p: { hero_id: number; last_games?: number; last_days?: number } = { hero_id: s.hero_id };
  if (s.kind === 'days') {
    if (s.n !== 'all') p.last_days = s.n;
  } else if (s.n !== 'all') {
    p.last_games = s.n;
  }
  return p;
}

export function windowLabel(s: PlayerScope): string {
  if (s.kind === 'days') return `last ${s.n} days`;
  return s.n === 'all' ? 'all loaded' : `last ${s.n} games`;
}

export interface ScopeSide {
  matches: number;
  span_from?: string | null;
  span_to?: string | null;
}

//Pinned locale + UTC so SSR and client render the identical string.
function spanDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function spanText(side: ScopeSide): string {
  if (!side.span_from || !side.span_to) return '';
  return ` (${spanDay(side.span_from)}–${spanDay(side.span_to)})`;
}

export function sideScopeText(label: string, side: ScopeSide, scope: PlayerScope): string {
  if (side.matches === 0) {
    return `${label}: 0 games ${scope.kind === 'days' ? `in the last ${scope.n} days` : 'in this window'}`;
  }
  return `${label} ${side.matches} games${spanText(side)}`;
}

//An explicit hero prints "on <Hero>"; a 0-game side is stated, never dropped.
export function scopeCaption(args: {
  scope: PlayerScope;
  heroName?: string | null;
  you: ScopeSide;
  youLabel?: string;
  themLabel?: string;
  them?: ScopeSide;
}): string {
  const { scope, heroName, you, youLabel, themLabel, them } = args;
  const hero = scope.hero_id === 0 ? 'All heroes' : `on ${heroName ?? 'selected hero'}`;
  const sides = [sideScopeText(youLabel ?? 'You', you, scope)];
  if (themLabel != null && them != null) sides.push(sideScopeText(themLabel, them, scope));
  return `${hero} · ${windowLabel(scope)} · ${sides.join(' · ')}`;
}
