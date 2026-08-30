//URL<->match_mode mapping for the ranked-axis selector (047); pure + DOM-free so it unit-tests.
import type { MatchMode } from '../types/api';

export const DEFAULT_MATCH_MODE: MatchMode = 'Unranked';
export const MATCH_MODE_PARAM = 'ranked';

export function matchModeFromParam(raw: string | null | undefined): MatchMode {
  if (raw == null) return DEFAULT_MATCH_MODE;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'ranked' ? 'Ranked' : DEFAULT_MATCH_MODE;
}

export function matchModeToParam(mode: MatchMode): string | null {
  return mode === 'Ranked' ? '1' : null;
}

//undefined for Unranked ⇒ the API request OMITS ?match_mode= ⇒ byte-identical to the pre-047 call.
export function matchModeQuery(mode: MatchMode): 'Ranked' | undefined {
  return mode === 'Ranked' ? 'Ranked' : undefined;
}

export function isRankedMode(mode: MatchMode): boolean {
  return mode === 'Ranked';
}
