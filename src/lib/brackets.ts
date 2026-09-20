//Rank-bracket buckets for the items, patch, profile-matchup and leaderboard filters: the integer
//0..5 the API takes (on the player's own rank), labelled by the ladder tiers each bracket spans.
import { getRank } from './ranks';

export interface RankBucket {
  //ITEM buckets use the integer the API wants (0..5); leaderboard buckets use string keys that
  //never reach the API.
  key: string | number;
  label: string;
  short: string;
  //rank tiers spanned; empty = all ranks.
  tiers: number[];
}

export function tierSpanLabel(tiers: readonly number[]): string {
  if (tiers.length === 0) return 'All ranks';
  const lo = getRank(Math.min(...tiers)).name;
  const hi = getRank(Math.max(...tiers)).name;
  return lo === hi ? lo : `${lo} to ${hi}`;
}

export function rankBucket(key: string | number, tiers: number[], short?: string): RankBucket {
  const lowest = tiers.length === 0 ? 'All' : `${getRank(Math.min(...tiers)).name}+`;
  return { key, label: tierSpanLabel(tiers), short: short ?? lowest, tiers };
}

//The five brackets /items/stats?bracket= and the analytics tables share: badge 11-36, 41-56,
//61-76, 81-96 and 101-116 on the same 11..116 scale.
export const ITEM_BUCKETS: readonly RankBucket[] = [
  rankBucket(0, []),
  rankBucket(1, [1, 2, 3]),
  rankBucket(2, [4, 5]),
  rankBucket(3, [6, 7]),
  rankBucket(4, [8, 9]),
  rankBucket(5, [10, 11]),
];

export function itemBracketParam(key: RankBucket['key']): number {
  return typeof key === 'number' ? key : 0;
}

//The hero <select> value → the API's hero_id; 0 ("All heroes") is omitted from the query.
export function itemHeroParam(hero: number): number | undefined {
  return Number.isInteger(hero) && hero > 0 ? hero : undefined;
}

//A bracket's tiers → the inclusive badge range /leaderboard filters on (badge = tier*10 + subrank,
//subranks I to VI); empty tiers → null so the caller omits both params and gets the full ladder.
export function badgeRangeForTiers(
  tiers: readonly number[],
): { min_badge: number; max_badge: number } | null {
  if (tiers.length === 0) return null;
  return { min_badge: Math.min(...tiers) * 10 + 1, max_badge: Math.max(...tiers) * 10 + 6 };
}
