//Per-match SSR <title>: "Match #<id> — Amber k–k Sapphire, <winner> win", score =
//team kills (mirrors the scoreboard). Missing rows fall back, never a half-true score.
import type { MatchDetail } from '../types/api';
import { TEAM, teamKills, teamPlayers } from './match';

export const GENERIC_MATCH_TITLE = 'Match — RankLock';

export function matchPageTitle(match: MatchDetail | null | undefined): string {
  if (!match?.players?.length) return GENERIC_MATCH_TITLE;
  const amber = teamPlayers(match, TEAM.amber);
  const sapphire = teamPlayers(match, TEAM.sapphire);
  if (amber.length === 0 || sapphire.length === 0) return GENERIC_MATCH_TITLE;

  const score = `Amber ${teamKills(amber)}–${teamKills(sapphire)} Sapphire`;
  const winner =
    match.winning_team === TEAM.amber ? 'Amber' : match.winning_team === TEAM.sapphire ? 'Sapphire' : null;
  return `Match #${match.match_id} — ${score}${winner ? `, ${winner} win` : ''}`;
}
