//Every window the roster can be read in, fetched in the background while the page sits on one, so
//clicking "Last 10" reads cache instead of blanking eleven columns. The five 060 metrics take no
//window, so they are never refetched per window.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { SCORECARD_METRICS } from '../../../lib/lanePercentile';
import type { RosterSlot } from '../../../lib/laneRoster';
import { WINDOWS, windowParams, type WindowKey } from './CompareBar';
import { WINDOWLESS_METRICS } from './usePlayerCurves';
import type { LaneMatchMode } from './usePlayerModeGames';

//Four at a time: the browser caps a host at six connections, so a wider fan-out would queue behind
//itself and slow the window the user is actually looking at.
const CONCURRENCY = 4;
//Long enough for the visible window's own requests to be in flight first.
const START_DELAY_MS = 500;

export function useWindowPrefetch(
  roster: readonly RosterSlot[],
  matchMode: LaneMatchMode,
  current: WindowKey,
) {
  const client = useQueryClient();
  const rosterKey = roster.map((p) => `${p.account_id}:${p.scope.hero_id ?? ''}`).join(',');

  useEffect(() => {
    if (roster.length === 0) return;
    let stopped = false;

    const jobs: (() => Promise<unknown>)[] = [];
    for (const w of WINDOWS) {
      if (w.key === current) continue;
      for (const p of roster) {
        for (const m of SCORECARD_METRICS) {
          if (WINDOWLESS_METRICS.has(m.key)) continue;
          const params = {
            metric: m.key,
            match_mode: matchMode,
            ...(p.scope.hero_id == null ? {} : { hero: p.scope.hero_id }),
            ...windowParams(w.key),
          };
          jobs.push(() =>
            client
              .prefetchQuery({
                queryKey: queryKeys.playerEconomyCurve(p.account_id, params),
                queryFn: () => api.getPlayerEconomyCurve(p.account_id, params),
                staleTime: 10 * 60 * 1000,
                retry: false,
              })
              .catch(() => undefined),
          );
        }
      }
    }

    const run = async () => {
      while (jobs.length > 0 && !stopped) {
        await Promise.all(jobs.splice(0, CONCURRENCY).map((job) => job()));
      }
    };
    const timer = setTimeout(run, START_DELAY_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [client, rosterKey, matchMode, current]);
}
