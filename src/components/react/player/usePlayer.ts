//============================================================================
//Player-dashboard data hooks (C5).
//
//Every per-user query lives here so the query KEYS stay consistent across the
//header, the overview panels, and each tab — and so react-query DEDUPES: the
//radar, coaching tips, and categorized panels all call useImprove(id) but only
//ONE /improve request goes out. The "rich-tier" endpoints (performance / improve
/// compare) use retry:false so a build-ahead 202/404/501 empty-states fast
//instead of retrying three times (requirements §8.1, §A.6).
//============================================================================
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isUnauthorized, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { readNumericId } from '../../../lib/routeParams';

//Read the player id from the URL on mount. undefined = not read yet (the first
//client render, before the effect); null = read but absent/invalid; number = id.
export function usePlayerId(): number | null | undefined {
  const [id, setId] = useState<number | null | undefined>(undefined);
  useEffect(() => setId(readNumericId('players')), []);
  return id;
}

//The signed-in viewer (GET /me). A 401 is the normal "not logged in" case and is
//surfaced as isError (not a throw) — never retried. Drives the "My Stats" branch.
export function useViewer() {
  const q = useQuery({
    queryKey: queryKeys.me(),
    queryFn: api.getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return { viewer: q.data, loggedIn: !q.isError && q.data != null, notLoggedIn: isUnauthorized(q.error) };
}

//All id-keyed hooks gate on a positive id so a not-yet-resolved (0) or invalid id
//never fires a wasted /players/0 fetch. The per-player AGGREGATES (profile, hero
//ledger, heroes-played, percentiles, compare) are mode-separated (022), so each
//reads the global game mode and re-keys/refetches when the header toggle flips. The
//per-MATCH list (usePlayerMatches) is NOT mode-separated — it enumerates matches.
export const usePlayer = (id: number) => {
  const { mode } = useGameMode();
  return useQuery({ queryKey: queryKeys.player(id, mode), queryFn: () => api.getPlayer(id, mode), enabled: id > 0 });
};

export const usePlayerMatches = (id: number, limit = 20) =>
  useQuery({ queryKey: queryKeys.playerMatches(id, { limit }), queryFn: () => api.getPlayerMatches(id, { limit }), enabled: id > 0 });

export const usePlayerHeroes = (id: number) => {
  const { mode } = useGameMode();
  return useQuery({ queryKey: queryKeys.playerHeroes(id, mode), queryFn: () => api.getPlayerHeroes(id, mode), enabled: id > 0 });
};

//The dedicated hero-selector source (§A.4) — the real /heroes-played endpoint,
//NOT a hero list derived client-side from /matches. Powers the Compare dropdown.
export const usePlayerHeroesPlayed = (id: number) => {
  const { mode } = useGameMode();
  return useQuery({
    queryKey: queryKeys.playerHeroesPlayed(id, mode),
    queryFn: () => api.getPlayerHeroesPlayed(id, mode),
    enabled: id > 0,
  });
};

export const usePlayerPerformance = (id: number) => {
  const { mode } = useGameMode();
  return useQuery({
    queryKey: queryKeys.playerPerformance(id, mode),
    queryFn: () => api.getPlayerPerformance(id, mode),
    retry: false,
    enabled: id > 0,
  });
};

//Improve's cohort (player_cohort_benchmarks) is Normal-ONLY (022 — laning/9-min
//coaching has no Brawl meaning), so this is PINNED to Normal regardless of the
//global toggle. The coaching panels surface a "Normal-only" note when the user is in
//Brawl so the page never silently implies Brawl coaching exists. See AnalyticsPanels.
export const useImprove = (id: number) =>
  useQuery({ queryKey: queryKeys.playerImprove(id), queryFn: () => api.getPlayerImprove(id), retry: false, enabled: id > 0 });

//opts carries the selected hero_id from /heroes-played plus the optional league/tier
//knobs; the keys mirror the backend CompareQuery (hero_id/league_offset/target_tier).
//An absent opts ⇒ the server-default cohort. compare's cohort baseline is
//hero_tier_cohort_mv (mode-separated), so it follows the global mode.
export const useCompare = (id: number, opts?: { hero_id?: number; league_offset?: string; target_tier?: number }) => {
  const { mode } = useGameMode();
  const params = { ...(opts ?? {}), game_mode: mode };
  return useQuery({
    queryKey: queryKeys.playerCompare(id, params),
    queryFn: () => api.getPlayerCompare(id, params),
    retry: false,
    enabled: id > 0,
  });
};

//Compare-to-a-specific-player: `vs` is the other player's account_id (gates the
//fetch — undefined/0 means no player picked yet), `hero_id` scopes the shared-hero
//overlap. retry:false so a build-ahead 202/501 or a 404 (no overlap) empty-states
//fast instead of retrying. Both players' aggregates are mode-separated → follows mode.
export const useComparePlayer = (id: number, vs: number | undefined, hero_id?: number) => {
  const { mode } = useGameMode();
  return useQuery({
    queryKey: queryKeys.playerComparePlayer(id, { vs, hero_id, game_mode: mode }),
    queryFn: () => api.getPlayerComparePlayer(id, { vs: vs!, hero_id, game_mode: mode }),
    retry: false,
    enabled: id > 0 && (vs ?? 0) > 0,
  });
};
