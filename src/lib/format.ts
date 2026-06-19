//============================================================================
//Display formatters + small stat derivations shared by the SEO pages and the
//table islands (C4). Pure functions, no I/O — safe at build time and on the
//client. Null/undefined inputs render an em-dash so a build-ahead empty cell
//never shows "NaN%" or "null".
//============================================================================

export const DASH = '—';

/** A percentage value (already 0–100) → "53.8%"; null/undefined → "—". */
export function pct(n: number | null | undefined, dp = 1): string {
  return n == null || Number.isNaN(n) ? DASH : `${n.toFixed(dp)}%`;
}

/** A fixed-precision number → "2.71"; null/undefined → "—". */
export function fixed(n: number | null | undefined, dp = 2): string {
  return n == null || Number.isNaN(n) ? DASH : n.toFixed(dp);
}

/** An integer count → "1,840"; null/undefined → "—". */
export function count(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? DASH : Math.round(n).toLocaleString('en-US');
}

/** KDA = (kills + assists) / max(1, deaths). null when any input is missing. */
export function kda(
  kills: number | null | undefined,
  deaths: number | null | undefined,
  assists: number | null | undefined,
): number | null {
  if (kills == null || deaths == null || assists == null) return null;
  return (kills + assists) / Math.max(1, deaths);
}

//Meta tier-list grade derived transparently from win-rate (a presentational
//grade of the real measured win_rate, not an invented stat — every Deadlock
//stats site grades the meta this way). Thresholds are relative to the 50% pivot.
export function metaTier(winRate: number | null | undefined): 'S' | 'A' | 'B' | 'C' | 'D' | null {
  if (winRate == null || Number.isNaN(winRate)) return null;
  if (winRate >= 52.5) return 'S';
  if (winRate >= 51) return 'A';
  if (winRate >= 49.5) return 'B';
  if (winRate >= 48) return 'C';
  return 'D';
}

//Pick share (%) of one hero's pick count within the currently-loaded row set.
//The API serves `picks` as a raw count, not a percentage; deriving the share
//across the shown rows is an honest "pick rate among ranked heroes" rather than
//hardcoding a fabricated percentage.
export function pickShare(picks: number | null | undefined, totalPicks: number): number | null {
  if (picks == null || totalPicks <= 0) return null;
  return (picks / totalPicks) * 100;
}

/** Seconds → "32:41" (mm:ss); null/undefined → "—". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return DASH;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

//ISO timestamp → "Jun 19, 2026" (UTC, stable across build/runtime). Invalid →
//empty string so a missing date never renders "Invalid Date" (requirements §7).
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
