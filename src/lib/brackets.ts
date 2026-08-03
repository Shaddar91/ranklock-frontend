//============================================================================
//Rank-bracket buckets — the "meta at your rank" filter model (C4).
//
//THE ITEMS BUG FIX (requirements §B.5 / §7.7): the old UI labelled item
//brackets with raw MMR-score ranges, while the backend filters by BADGE TIER.
//These buckets are labelled by Deadlock RANK TIERS / emblems instead, so the
//filter reads "Ascendant–Eternus", never "MMR 4500–6000".
//
//Two backends, two param encodings (verified against deadlock-backend/src):
//  • /items/stats?bracket=<int 0..5>  — `bracket_badge_range`:
//        1: badge 11–36  Initiate–Alchemist     2: 41–56  Arcanist–Ritualist
//        3: 61–76  Emissary–Archon              4: 81–96  Oracle–Phantom
//        5: 101–116 Ascendant–Eternus           0: all
//  • /heroes?bracket=<low|mid|high|top>  — `valid_brackets = [low,mid,high,top]`
//        (the hero_bracket_mv string convention; absent = all/current MV).
//
//Both selectors render rank emblems + a tier-range label via lib/ranks, so the
//"badge tiers, not MMR ranges" contract holds across heroes AND items.
//============================================================================
export interface RankBucket {
  //stable selector key. ITEM buckets use the integer the API wants (0..5);
  //Leaderboard buckets use arbitrary string keys (not sent to the API).
  key: string | number;
  //tier-range label (emblem-backed) — never an MMR range.
  label: string;
  //compact label for tight chrome.
  short: string;
  //rank tiers spanned (for emblem display); empty = "All ranks".
  tiers: number[];
}

//Items: the exact 0–5 integer buckets the backend maps to badge ranges.
export const ITEM_BUCKETS: readonly RankBucket[] = [
  { key: 0, label: 'All ranks', short: 'All', tiers: [] },
  { key: 1, label: 'Initiate – Alchemist', short: 'Initiate+', tiers: [1, 2, 3] },
  { key: 2, label: 'Arcanist – Ritualist', short: 'Arcanist+', tiers: [4, 5] },
  { key: 3, label: 'Emissary – Archon', short: 'Emissary+', tiers: [6, 7] },
  { key: 4, label: 'Oracle – Phantom', short: 'Oracle+', tiers: [8, 9] },
  { key: 5, label: 'Ascendant – Eternus', short: 'Ascendant+', tiers: [10, 11] },
];

//An item bucket key → the API's integer bracket (0 = all).
export function itemBracketParam(key: RankBucket['key']): number {
  return typeof key === 'number' ? key : 0;
}

//A rank band's tiers → the inclusive badge range the backend's /leaderboard
//filters on (badge = tier*10 + subrank, subranks I–VI). Mirrors the verified
//items `bracket_badge_range` convention (tier*10+1 … tier*10+6): Oracle–Phantom
//(tiers 8,9) → 81…96, Ascendant–Eternus (10,11) → 101…116. Empty tiers ("All
//ranks") → null so the caller omits both params and gets the full ladder.
export function badgeRangeForTiers(
  tiers: readonly number[],
): { min_badge: number; max_badge: number } | null {
  if (tiers.length === 0) return null;
  return { min_badge: Math.min(...tiers) * 10 + 1, max_badge: Math.max(...tiers) * 10 + 6 };
}
