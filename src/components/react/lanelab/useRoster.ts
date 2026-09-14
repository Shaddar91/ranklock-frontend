//The Lane Lab roster as React state, kept in the URL so a comparison is a link. Names are not in
//the URL — they are re-read per id, so a shared link can never show a stale display name.
import { useCallback, useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import {
  ROSTER_MAX,
  addToRoster,
  decodeRoster,
  encodeRoster,
  removeFromRoster,
  scopeRoster,
  withColors,
  type HeroScope,
  type RosterEntry,
  type RosterSlot,
} from '../../../lib/laneRoster';

const PARAM = 'players';

export interface UseRoster {
  roster: RosterSlot[];
  full: boolean;
  add: (entry: RosterEntry) => void;
  remove: (account_id: number) => void;
  scope: (account_id: number, scope: HeroScope) => void;
}

export function useRoster(): UseRoster {
  //Decode once on mount: on the server there is no location, so the roster starts empty and the
  //island fills it after hydration rather than rendering a mismatched tree.
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [seeded, setSeeded] = useState<{ account_id: number; hero_id: number | null }[]>([]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(PARAM);
    setSeeded(decodeRoster(raw));
  }, []);

  //A seeded id carries no name, so resolve each one before it becomes a chip.
  const resolved = useQueries({
    queries: seeded.map((s) => ({
      queryKey: queryKeys.player(s.account_id, 'Normal'),
      queryFn: () => api.getPlayer(s.account_id, 'Normal'),
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  });

  useEffect(() => {
    if (seeded.length === 0) return;
    if (resolved.some((q) => q.isPending)) return;
    const next: RosterEntry[] = [];
    seeded.forEach((s, i) => {
      const p = resolved[i]?.data;
      if (!p) return;
      next.push({
        account_id: s.account_id,
        name: p.steam_name,
        scope: { hero_id: s.hero_id, hero_name: null },
      });
    });
    setEntries(next.slice(0, ROSTER_MAX));
    setSeeded([]);
    //resolved is a fresh array each render; gating on isPending above is what stops the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, resolved.map((q) => q.status).join(',')]);

  //Mirror the roster into the URL without a navigation, so back/forward stay the page's own.
  useEffect(() => {
    const url = new URL(window.location.href);
    const encoded = encodeRoster(entries);
    if (encoded) url.searchParams.set(PARAM, encoded);
    else url.searchParams.delete(PARAM);
    window.history.replaceState(null, '', url);
  }, [entries]);

  const add = useCallback((entry: RosterEntry) => {
    setEntries((cur) => addToRoster(cur, entry));
  }, []);
  const remove = useCallback((account_id: number) => {
    setEntries((cur) => removeFromRoster(cur, account_id));
  }, []);
  const scope = useCallback((account_id: number, next: HeroScope) => {
    setEntries((cur) => scopeRoster(cur, account_id, next));
  }, []);

  return {
    roster: withColors(entries),
    full: entries.length >= ROSTER_MAX,
    add,
    remove,
    scope,
  };
}
