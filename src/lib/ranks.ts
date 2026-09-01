//============================================================================
//Deadlock rank metadata + emblem helpers (ported from the prototype data.jsx).
//
//Ranks are a FIXED 12-tier ladder (Obscurus … Eternus), each with a subrank
//I–VI. The API exposes a player's rank as a single `badge` number = tier*10 +
//subrank (see types/api.ts). The rank EMBLEMS are app-owned design assets bundled
//under public/assets/ranks/ (not served by the API), so they live here, not in
//the API client.
//============================================================================

export interface RankMeta {
  tier: number;
  name: string;
  color: string;
}

//Ordered by tier 0..11; index === tier.
export const RANKS: readonly RankMeta[] = [
  { tier: 0, name: 'Obscurus', color: '#7d7d7d' },
  { tier: 1, name: 'Initiate', color: '#a06a3e' },
  { tier: 2, name: 'Seeker', color: '#c2456f' },
  { tier: 3, name: 'Alchemist', color: '#7d8fd6' },
  { tier: 4, name: 'Arcanist', color: '#8fc35f' },
  { tier: 5, name: 'Ritualist', color: '#dda326' },
  { tier: 6, name: 'Emissary', color: '#ee4f57' },
  { tier: 7, name: 'Archon', color: '#b47feb' },
  { tier: 8, name: 'Oracle', color: '#c1794a' },
  { tier: 9, name: 'Phantom', color: '#9aa3ad' },
  { tier: 10, name: 'Ascendant', color: '#c39751' },
  { tier: 11, name: 'Eternus', color: '#5ce9a9' },
];

export const SUBRANK_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

//Clamp a tier into range and return a definite RankMeta (never undefined —
//tsconfig noUncheckedIndexedAccess makes raw RANKS[t] possibly-undefined).
export function getRank(tier: number): RankMeta {
  const clamped = Math.max(0, Math.min(RANKS.length - 1, Math.floor(tier)));
  return RANKS[clamped] as RankMeta;
}

//Public emblem path. Files live at public/assets/ranks/rankNN-<name>.png and are
//served from the site root, so the URL is absolute ("/assets/…").
export function rankImg(tier: number): string {
  const r = getRank(tier);
  return `/assets/ranks/rank${String(r.tier).padStart(2, '0')}-${r.name.toLowerCase()}.png`;
}

//"Archon IV" style label. sub is 1..6 (0/undefined → no numeral).
export function subLabel(tier: number, sub?: number | null): string {
  const r = getRank(tier);
  if (!sub) return r.name;
  const numeral = SUBRANK_NUMERALS[sub - 1];
  return numeral ? `${r.name} ${numeral}` : r.name;
}

//Decompose an API badge (tier*10 + subrank) into { tier, sub }. null → null.
export function rankFromBadge(badge: number | null | undefined): { tier: number; sub: number } | null {
  if (badge == null || badge <= 0) return null;
  return { tier: Math.floor(badge / 10), sub: badge % 10 };
}

//The rank you're chasing: one tier above the badge's tier, clamped to the ladder
//top. null when the badge is unknown.
export function chasingTier(badge: number | null | undefined): number | null {
  const r = rankFromBadge(badge);
  return r ? Math.min(RANKS.length - 1, r.tier + 1) : null;
}

//Meta tier-list pill colors (S/A/B/C/D).
export const TIER_COLOR: Record<string, string> = {
  S: '#fbbf24',
  A: '#a78bfa',
  B: '#60a5fa',
  C: '#34d399',
  D: '#94a3b8',
};
