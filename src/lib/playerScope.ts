//Player compare scope — ONE {kind, n, hero_id} state shared by the radar and the
//Compare tab so solo shape and overlay read the SAME window + hero scope. Pure
//functions; the React state hook is player/usePlayerScope.

export type PlayerScopeKind = 'games' | 'days';

export interface PlayerScope {
  kind: PlayerScopeKind;
  n: number | 'all';
  hero_id: number;
}

export const DEFAULT_SCOPE: PlayerScope = { kind: 'games', n: 'all', hero_id: 0 };

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
  themLabel?: string;
  them?: ScopeSide;
}): string {
  const { scope, heroName, you, themLabel, them } = args;
  const hero = scope.hero_id === 0 ? 'All heroes' : `on ${heroName ?? 'selected hero'}`;
  const sides = [sideScopeText('You', you, scope)];
  if (themLabel != null && them != null) sides.push(sideScopeText(themLabel, them, scope));
  return `${hero} · ${windowLabel(scope)} · ${sides.join(' · ')}`;
}
