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
//never fires a wasted /players/0 fetch.
export const usePlayer = (id: number) =>
  useQuery({ queryKey: queryKeys.player(id), queryFn: () => api.getPlayer(id), enabled: id > 0 });

export const usePlayerMatches = (id: number, limit = 20) =>
  useQuery({ queryKey: queryKeys.playerMatches(id, { limit }), queryFn: () => api.getPlayerMatches(id, { limit }), enabled: id > 0 });

export const usePlayerHeroes = (id: number) =>
  useQuery({ queryKey: queryKeys.playerHeroes(id), queryFn: () => api.getPlayerHeroes(id), enabled: id > 0 });

//The dedicated hero-selector source (§A.4) — the real /heroes-played endpoint,
//NOT a hero list derived client-side from /matches. Powers the Compare dropdown.
export const usePlayerHeroesPlayed = (id: number) =>
  useQuery({ queryKey: queryKeys.playerHeroesPlayed(id), queryFn: () => api.getPlayerHeroesPlayed(id), enabled: id > 0 });

export const usePlayerPerformance = (id: number) =>
  useQuery({ queryKey: queryKeys.playerPerformance(id), queryFn: () => api.getPlayerPerformance(id), retry: false, enabled: id > 0 });

export const useImprove = (id: number) =>
  useQuery({ queryKey: queryKeys.playerImprove(id), queryFn: () => api.getPlayerImprove(id), retry: false, enabled: id > 0 });

//hero is the selected hero_id from /heroes-played (undefined = server default).
export const useCompare = (id: number, hero?: number) =>
  useQuery({
    queryKey: queryKeys.playerCompare(id, { hero: hero ?? null }),
    queryFn: () => api.getPlayerCompare(id, { hero }),
    retry: false,
    enabled: id > 0,
  });
