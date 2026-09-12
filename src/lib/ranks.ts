//Deadlock rank ladder: 12 tiers (Obscurus … Eternus), each with a subrank I–VI.
//The API exposes a player's rank as one `badge` = tier*10 + subrank (types/api.ts).
//Names and colors are the assets.deadlock-api.com /v2/ranks ladder, probed 2026-09-11.

export interface RankMeta {
  tier: number;
  name: string;
  color: string;
}

//Ordered by tier 0..11; index === tier.
export const RANKS: readonly RankMeta[] = [
  { tier: 0, name: 'Obscurus', color: '#333333' },
  { tier: 1, name: 'Initiate', color: '#6A3E1E' },
  { tier: 2, name: 'Seeker', color: '#882355' },
  { tier: 3, name: 'Acolyte', color: '#5C6DAB' },
  { tier: 4, name: 'Sentinel', color: '#719C47' },
  { tier: 5, name: 'Mystic', color: '#DDA326' },
  { tier: 6, name: 'Ritualist', color: '#EE4F57' },
  { tier: 7, name: 'Emissary', color: '#B47FEB' },
  { tier: 8, name: 'Oracle', color: '#955138' },
  { tier: 9, name: 'Phantom', color: '#7C7C7C' },
  { tier: 10, name: 'Ascendant', color: '#C39751' },
  { tier: 11, name: 'Eternus', color: '#5CE9A9' },
];

export const SUBRANK_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

//Clamp a tier into range and return a definite RankMeta (never undefined —
//tsconfig noUncheckedIndexedAccess makes raw RANKS[t] possibly-undefined).
export function getRank(tier: number): RankMeta {
  const clamped = Math.max(0, Math.min(RANKS.length - 1, Math.floor(tier)));
  return RANKS[clamped] as RankMeta;
}

//Emblem path. Keyed by TIER only (not name) so a ladder rename never 404s the art;
//files are app-owned under public/assets/ranks/ and served from the site root.
export function rankImg(tier: number): string {
  return `/assets/ranks/rank${String(getRank(tier).tier).padStart(2, '0')}.png`;
}

//"Emissary IV" style label. sub is 1..6 (0/undefined → no numeral).
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

//Meta tier-list pill colors (S through F).
export const TIER_COLOR: Record<string, string> = {
  S: '#fbbf24',
  A: '#a78bfa',
  B: '#60a5fa',
  C: '#34d399',
  D: '#94a3b8',
  F: '#e2707a',
};
