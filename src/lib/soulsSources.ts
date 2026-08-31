//Pure transforms for the Souls-source panel (migration 048): merge the player line and the tier
//cohort onto one minute grid, negate losses to a below-zero line, answer the empty state. No I/O.
import type { PlayerSoulsResponse, SoulsCohortResponse } from '../types/api';

//The five sources that stack into net worth (fixed order) then the loss line; mirrors backend SOULS_GROUPS.
export const SOULS_STACK_GROUPS = ['lane_creeps', 'neutrals', 'heroes', 'objectives', 'denies'] as const;
export const SOULS_LOSS_GROUP = 'losses';
export const SOULS_GROUPS = [...SOULS_STACK_GROUPS, SOULS_LOSS_GROUP] as const;
export type SoulsGroup = (typeof SOULS_GROUPS)[number];

export const SOULS_GROUP_LABEL: Record<SoulsGroup, string> = {
  lane_creeps: 'Lane creeps',
  neutrals: 'Neutrals',
  heroes: 'Hero kills',
  objectives: 'Objectives',
  denies: 'Denies',
  losses: 'Souls lost',
};

//Losses subtract from net worth, so they render NEGATIVE; every other source is additive.
export function displaySign(group: string): 1 | -1 {
  return group === SOULS_LOSS_GROUP ? -1 : 1;
}

export type SoulsSide = 'you' | 'tier';

export function soulsKey(side: SoulsSide, group: SoulsGroup): string {
  return `${side}_${group}`;
}

//One row per minute in ANY series of either side; keys `${side}_${group}`, absent ones omitted (a gap, not 0).
export interface SoulsSourceRow {
  min: number;
  [seriesKey: string]: number | undefined;
}

interface SoulsGroupsCarrier {
  groups?: ReadonlyArray<{ souls_group: string; points?: ReadonlyArray<{ t_seconds: number; souls_avg: number | null }> }>;
}

//{group → {game-minute → signed souls}} for one side; unknown groups and null souls_avg are dropped.
function sideByMinute(resp: SoulsGroupsCarrier | null | undefined): Map<SoulsGroup, Map<number, number>> {
  const maps = new Map<SoulsGroup, Map<number, number>>();
  for (const g of SOULS_GROUPS) maps.set(g, new Map());
  for (const series of resp?.groups ?? []) {
    const target = maps.get(series.souls_group as SoulsGroup);
    if (!target) continue;
    const sign = displaySign(series.souls_group);
    for (const p of series.points ?? []) {
      if (p.souls_avg == null) continue;
      target.set(Math.round(p.t_seconds / 60), p.souls_avg * sign);
    }
  }
  return maps;
}

//Merge the player line (`you`) and tier cohort (`tier`) into rows; either side may be absent.
export function buildSoulsSourceSeries(
  player: PlayerSoulsResponse | null | undefined,
  cohort: SoulsCohortResponse | null | undefined,
): SoulsSourceRow[] {
  const sides: Record<SoulsSide, Map<SoulsGroup, Map<number, number>>> = {
    you: sideByMinute(player),
    tier: sideByMinute(cohort),
  };
  const minutes = new Set<number>();
  for (const g of SOULS_GROUPS) {
    for (const m of sides.you.get(g)!.keys()) minutes.add(m);
    for (const m of sides.tier.get(g)!.keys()) minutes.add(m);
  }
  return [...minutes]
    .sort((a, b) => a - b)
    .map((min) => {
      const row: SoulsSourceRow = { min };
      for (const side of ['you', 'tier'] as SoulsSide[]) {
        for (const g of SOULS_GROUPS) {
          const v = sides[side].get(g)!.get(min);
          if (v !== undefined) row[soulsKey(side, g)] = v;
        }
      }
      return row;
    });
}

//The honest per-player empty state: no souls response, ?hero= matched zero games, or all six series empty.
export function isPlayerSoulsEmpty(player: PlayerSoulsResponse | null | undefined): boolean {
  if (!player) return true;
  if (player.player_hero_games === 0) return true;
  return (player.groups ?? []).every((g) => (g.points?.length ?? 0) === 0);
}

export function hasCohortSouls(cohort: SoulsCohortResponse | null | undefined): boolean {
  return (cohort?.groups ?? []).some((g) => (g.points?.length ?? 0) > 0);
}
