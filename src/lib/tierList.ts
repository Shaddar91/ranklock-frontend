//Tier-list grouping for /tier-list/: the S-F cut points metaTier() applies plus
//the per-tier aggregates the page prints. Pure, safe at build and on the client.
import { metaTier } from './format';

export type MetaTier = Exclude<ReturnType<typeof metaTier>, null>;

export interface TierCut {
  tier: MetaTier;
  //Inclusive lower bound in win-rate percent; null on the bottom cut.
  min: number | null;
}

//Must stay in lockstep with metaTier(): the page prints these as the published thresholds.
export const TIER_CUTS: readonly TierCut[] = [
  { tier: 'S', min: 52.5 },
  { tier: 'A', min: 51 },
  { tier: 'B', min: 49.5 },
  { tier: 'C', min: 48 },
  { tier: 'D', min: 47 },
  { tier: 'F', min: null },
];

export function cutLabel(cut: TierCut, above: TierCut | undefined): string {
  if (cut.min == null) return `below ${(above?.min ?? 0).toFixed(1)}%`;
  return `${cut.min.toFixed(1)}% and above`;
}

export interface TierRow {
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  picks: number;
  win_rate: number | null;
}

export interface TierBlock<T extends TierRow> {
  tier: MetaTier;
  cut: TierCut;
  label: string;
  heroes: T[];
  lowest: number | null;
  highest: number | null;
  picks: number;
}

//Group rated rows into the six cuts, each block ordered by win rate. An unrated row is
//dropped rather than graded, because placing it in F would read as a measurement.
export function tierBlocks<T extends TierRow>(rows: T[]): TierBlock<T>[] {
  const byTier = new Map<MetaTier, T[]>(TIER_CUTS.map((c) => [c.tier, [] as T[]]));
  for (const row of rows) {
    const tier = metaTier(row.win_rate);
    if (tier == null) continue;
    byTier.get(tier)?.push(row);
  }
  return TIER_CUTS.map((cut, i) => {
    const heroes = [...(byTier.get(cut.tier) ?? [])].sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0));
    const rates = heroes.map((h) => h.win_rate as number);
    return {
      tier: cut.tier,
      cut,
      label: cutLabel(cut, TIER_CUTS[i - 1]),
      heroes,
      lowest: rates.length > 0 ? Math.min(...rates) : null,
      highest: rates.length > 0 ? Math.max(...rates) : null,
      picks: heroes.reduce((sum, h) => sum + (h.picks ?? 0), 0),
    };
  });
}

export const gradedCount = <T extends TierRow>(blocks: TierBlock<T>[]): number =>
  blocks.reduce((sum, b) => sum + b.heroes.length, 0);
