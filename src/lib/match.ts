//============================================================================
//Match-domain helpers (C5). Pure functions over the served MatchDetail — team
//split, team totals, MVP ordering — shared by the match scoreboard island and
//the (deferred) inspector island. Deadlock's two teams are Amber = team 0 and
//Sapphire = team 1 (the prototype's convention).
//============================================================================
import type { MatchDetail, MatchPlayerDetail } from '../types/api';

export const TEAM = { amber: 0, sapphire: 1 } as const;

//Players on a team, ordered best→worst by net worth (so index+1 is the MVP rank).
export function teamPlayers(match: MatchDetail, team: number): MatchPlayerDetail[] {
  return match.players.filter((p) => p.team === team).sort((a, b) => b.net_worth - a.net_worth);
}

export const teamKills = (players: MatchPlayerDetail[]): number => players.reduce((s, p) => s + p.kills, 0);

export const teamNetWorth = (players: MatchPlayerDetail[]): number => players.reduce((s, p) => s + p.net_worth, 0);
