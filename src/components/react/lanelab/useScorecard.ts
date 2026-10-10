//The scorecard cells and the league menu's sample counts: one /lane-lab/scorecard read, plus player
//and league curve reads only where that read cannot answer.
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api, isNotFound, queryKeys } from '../../../lib/apiClient';
import { SCORECARD_METRICS } from '../../../lib/lanePercentile';
import { encodeRoster, type RosterSlot } from '../../../lib/laneRoster';
import { bucketValue, curveMetrics } from '../../../lib/laneScorecard';
import { windowParams, type WindowKey } from './CompareBar';
import { LEAGUE_TIERS } from './LadderPanel';
import { WINDOWLESS_METRICS } from './usePlayerCurves';
import type { LaneMatchMode } from './usePlayerModeGames';

const METRICS = SCORECARD_METRICS.map((m) => m.key);
const WINDOWED = METRICS.filter((m) => !WINDOWLESS_METRICS.has(m));
const COVERAGE_METRIC = WINDOWED[0] ?? 'damage';

//Set by the first 404: the deployed API predates /lane-lab/scorecard.
let routeMissing = false;

export function useScorecard(
  roster: readonly RosterSlot[],
  metric: string,
  bucket: number,
  matchMode: LaneMatchMode,
  windowKey: WindowKey,
  modeGames: Map<number, number | null>,
) {
  const params = { accounts: encodeRoster(roster), metric, bucket, match_mode: matchMode };
  const bulk = useQuery({
    queryKey: queryKeys.laneScorecard(params),
    queryFn: () =>
      api.getLaneScorecard(params).catch((e: unknown) => {
        if (isNotFound(e)) routeMissing = true;
        throw e;
      }),
    enabled: roster.length > 0 && !routeMissing,
    staleTime: 10 * 60 * 1000,
    retry: false,
    //A held part must still be true: a line per slot, bucket and mode; league peaks per metric.
    placeholderData: (prev, prevQuery) => {
      const p = prevQuery?.queryKey[2] as Partial<typeof params> | undefined;
      if (!prev || !p) return undefined;
      const sameAxis = p.bucket === bucket && p.match_mode === matchMode;
      const held = new Set(sameAxis ? String(p.accounts).split(',') : []);
      return {
        accounts: prev.accounts.filter((a) =>
          held.has(encodeRoster(roster.filter((s) => s.account_id === a.account_id))),
        ),
        leagues: p.metric === metric ? prev.leagues : [],
      };
    },
  });
  const failed = bulk.isError || routeMissing;
  const settled = bulk.isSuccess && !bulk.isPlaceholderData ? bulk.data : null;
  const windowed = windowKey === 'all' ? [] : WINDOWED;

  const reads = roster.flatMap((p) => {
    const games = modeGames.get(p.account_id);
    return curveMetrics({ failed, settled }, p.account_id, games, METRICS, windowed).map((m) => ({ p, m }));
  });
  const curves = useQueries({
    queries: reads.map(({ p, m }) => {
      const q = {
        metric: m,
        match_mode: matchMode,
        ...(p.scope.hero_id == null ? {} : { hero: p.scope.hero_id }),
        ...(WINDOWLESS_METRICS.has(m) ? {} : windowParams(windowKey)),
      };
      return {
        queryKey: queryKeys.playerEconomyCurve(p.account_id, q),
        queryFn: () => api.getPlayerEconomyCurve(p.account_id, q),
        staleTime: 10 * 60 * 1000,
        retry: false,
      };
    }),
  });
  const curveStamp = reads
    .map(({ p, m }, i) => `${p.account_id}:${m}:${curves[i]?.dataUpdatedAt ?? 0}`)
    .join(',');
  const lines = failed ? undefined : bulk.data;

  const { values, noTimeline } = useMemo(() => {
    const curveAt = new Map(reads.map(({ p, m }, i) => [`${p.account_id}:${m}`, curves[i]]));
    const served = new Map((lines?.accounts ?? []).map((a) => [a.account_id, a.values]));
    const cells = new Map<number, Map<string, number | null>>();
    for (const p of roster) {
      const row = new Map<string, number | null>();
      for (const m of METRICS) {
        const q = curveAt.get(`${p.account_id}:${m}`);
        const pts = q?.data?.you ?? q?.data?.points ?? [];
        row.set(m, q ? bucketValue(pts, bucket) : (served.get(p.account_id)?.[m] ?? null));
      }
      cells.set(p.account_id, row);
    }
    const thin =
      windowKey === 'all'
        ? []
        : roster.filter((p) => {
            const c = curveAt.get(`${p.account_id}:${COVERAGE_METRIC}`)?.data?.coverage;
            return c != null && c.matches_with_timeline === 0 && c.matches_total > 0;
          });
    return { values: cells, noTimeline: thin };
  }, [params.accounts, bucket, matchMode, windowKey, lines, curveStamp]);

  const fromCurves = roster.length === 0 || failed;
  const leagueCurves = useQueries({
    queries: LEAGUE_TIERS.map((t) => ({
      queryKey: queryKeys.laneEconomyCurve({ tier: t, metric }),
      queryFn: () => api.getLaneEconomyCurve({ tier: t, metric }),
      enabled: fromCurves,
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  });
  const leagueStamp = leagueCurves.map((q) => q.dataUpdatedAt).join(',');
  const leagueSamples = useMemo(() => {
    const out = new Map<number, number>();
    if (fromCurves) {
      LEAGUE_TIERS.forEach((t, i) => {
        const pts = leagueCurves[i]?.data?.points ?? [];
        const peak = pts.reduce((a, p) => Math.max(a, p.sample_players), 0);
        if (peak > 0) out.set(t, peak);
      });
    } else {
      for (const l of lines?.leagues ?? []) {
        if (l.peak_sample_players > 0) out.set(l.tier, l.peak_sample_players);
      }
    }
    return out;
  }, [fromCurves, metric, lines, leagueStamp]);

  return { values, noTimeline, leagueSamples };
}
