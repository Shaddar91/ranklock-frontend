//Match-inspect derivations (C4): pure functions over the /matches/:id/inspect
//payload — the per-sample team + per-player net-worth ("souls", never "gold") series
//for the Economy chart, plus the guards/labels the islands share. Unit-tested in node.
import type { MatchInspectPlayer } from '../types/api';

//Deadlock teams: 0 = Amber, 1 = Sapphire (lib/match.ts convention).
const AMBER = 0;

export type NetWorthRow = { t: number } & Record<string, number>;

export interface PlayerSeriesMeta {
  key: string;
  name: string;
  team: number;
}

//Names N once migration 051 seeds window_days, else an honest "a recent window".
export function windowNote(windowDays: number | null | undefined): string {
  return typeof windowDays === 'number' && windowDays > 0 ? `the last ${windowDays} days` : 'a recent window';
}

export const hasEconomyTimeline = (players: MatchInspectPlayer[]): boolean =>
  players.some((p) => p.souls_timeline.length > 0);

export const hasItemBuilds = (players: MatchInspectPlayer[]): boolean =>
  players.some((p) => p.items.length > 0);

function sampleGrid(players: MatchInspectPlayer[]): number[] {
  const ts = new Set<number>();
  for (const p of players) for (const s of p.souls_timeline) ts.add(s.t_seconds);
  return [...ts].sort((a, b) => a - b);
}

//Net worth carried onto the shared grid: at each grid time use the latest sample
//at-or-before it (0 before the first). Ascending souls_timeline ⇒ one forward pointer.
function carryForward(timeline: MatchInspectPlayer['souls_timeline'], grid: number[]): number[] {
  let idx = 0;
  let last = 0;
  return grid.map((t) => {
    for (let s = timeline[idx]; s && s.t_seconds <= t; s = timeline[idx]) {
      last = s.souls;
      idx++;
    }
    return last;
  });
}

export function teamNetWorthSeries(players: MatchInspectPlayer[]): NetWorthRow[] {
  const grid = sampleGrid(players);
  const rows: NetWorthRow[] = grid.map((t) => ({ t, amber: 0, sapphire: 0 }));
  for (const p of players) {
    const key = p.team === AMBER ? 'amber' : 'sapphire';
    carryForward(p.souls_timeline, grid).forEach((v, i) => {
      const row = rows[i];
      if (row) row[key] = (row[key] ?? 0) + v;
    });
  }
  return rows;
}

export function playerNetWorthSeries(players: MatchInspectPlayer[]): {
  rows: NetWorthRow[];
  series: PlayerSeriesMeta[];
} {
  const grid = sampleGrid(players);
  const rows: NetWorthRow[] = grid.map((t) => ({ t }));
  const series: PlayerSeriesMeta[] = [];
  for (const p of players) {
    const key = `p${p.account_id}`;
    series.push({ key, name: p.hero_name || p.steam_name, team: p.team });
    carryForward(p.souls_timeline, grid).forEach((v, i) => {
      const row = rows[i];
      if (row) row[key] = v;
    });
  }
  return { rows, series };
}

export function endNetWorth(player: MatchInspectPlayer): number {
  const last = player.souls_timeline.at(-1);
  return last ? last.souls : 0;
}

//Amber before Sapphire, richest first within a team (mirrors the scoreboard order).
export function sortInspectPlayers(players: MatchInspectPlayer[]): MatchInspectPlayer[] {
  return [...players].sort((a, b) => a.team - b.team || endNetWorth(b) - endNetWorth(a));
}
