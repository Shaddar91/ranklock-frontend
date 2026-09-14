//The Lane Lab roster: up to four players sharing one axis, in the order they were added, each with
//its own hero scope. Pure state helpers + the URL round-trip that makes a comparison linkable.

export const ROSTER_MAX = 4;

//One colour per slot in add order. Slot 0 is the page accent, so "you" is the orange line whichever
//account it is; the rest are chosen to stay apart on the foundry ground and for red-green blindness.
export const ROSTER_COLORS = [
  'var(--cyan-bright)',
  '#fb7185',
  '#22d3ee',
  '#bb9bf7',
] as const;

export interface HeroScope {
  hero_id: number | null;
  hero_name: string | null;
}

export const ALL_HEROES: HeroScope = { hero_id: null, hero_name: null };

export interface RosterEntry {
  account_id: number;
  name: string;
  scope: HeroScope;
}

export interface RosterSlot extends RosterEntry {
  color: string;
  index: number;
}

export const scopeLabel = (scope: HeroScope): string => scope.hero_name ?? 'All heroes';

export function withColors(roster: readonly RosterEntry[]): RosterSlot[] {
  return roster.slice(0, ROSTER_MAX).map((entry, index) => ({
    ...entry,
    index,
    color: ROSTER_COLORS[index % ROSTER_COLORS.length] ?? ROSTER_COLORS[0],
  }));
}

//Adding an account already on the axis is a no-op, not a second line: the same id twice would draw
//two identical curves and burn a slot.
export function addToRoster(
  roster: readonly RosterEntry[],
  entry: RosterEntry,
): RosterEntry[] {
  if (roster.length >= ROSTER_MAX) return [...roster];
  if (roster.some((r) => r.account_id === entry.account_id)) return [...roster];
  return [...roster, entry];
}

export function removeFromRoster(
  roster: readonly RosterEntry[],
  account_id: number,
): RosterEntry[] {
  return roster.filter((r) => r.account_id !== account_id);
}

export function scopeRoster(
  roster: readonly RosterEntry[],
  account_id: number,
  scope: HeroScope,
): RosterEntry[] {
  return roster.map((r) => (r.account_id === account_id ? { ...r, scope } : r));
}

//?players=104319610,103082711:67 — ids in axis order, a hero scope appended after a colon. Names
//are NOT encoded: they are re-read from the API so a shared link cannot carry a stale display name.
export function encodeRoster(roster: readonly RosterEntry[]): string {
  return roster
    .slice(0, ROSTER_MAX)
    .map((r) => (r.scope.hero_id == null ? `${r.account_id}` : `${r.account_id}:${r.scope.hero_id}`))
    .join(',');
}

export interface DecodedSlot {
  account_id: number;
  hero_id: number | null;
}

export function decodeRoster(raw: string | null | undefined): DecodedSlot[] {
  if (!raw) return [];
  const out: DecodedSlot[] = [];
  for (const part of raw.split(',')) {
    const [idRaw, heroRaw] = part.trim().split(':');
    const account_id = Number.parseInt(idRaw ?? '', 10);
    if (!Number.isSafeInteger(account_id) || account_id <= 0) continue;
    if (out.some((o) => o.account_id === account_id)) continue;
    const hero = heroRaw == null ? NaN : Number.parseInt(heroRaw, 10);
    out.push({ account_id, hero_id: Number.isSafeInteger(hero) ? hero : null });
    if (out.length >= ROSTER_MAX) break;
  }
  return out;
}

//The search box takes a name or a Steam id, but /players/search matches steam_name only — an
//all-digits query has to go to /players/{id} instead or a numeric search returns nothing.
export function asAccountId(query: string): number | null {
  const t = query.trim();
  if (!/^\d{4,12}$/.test(t)) return null;
  const n = Number.parseInt(t, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
