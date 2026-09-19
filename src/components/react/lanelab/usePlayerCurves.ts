//Per metric, one player curve per roster slot plus the league band, each fetched once per player.
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import type { RosterSlot } from '../../../lib/laneRoster';
import { windowParams, type WindowKey } from './CompareBar';

//The 060 five 400 on a windowed request: only the all-games accumulator carries their arrays.
export const WINDOWLESS_METRICS = new Set([
  'damage_taken',
  'player_healing',
  'damage_mitigated',
  'accuracy',
  'level',
]);

//Same five, other name: the arrays fill forward only; a game folded before 060 never gets a value.
export const FOLD_060_METRICS = WINDOWLESS_METRICS;

//Games folded before this date carry none of the five arrays; per mode so a refold can move one.
export const FOLD_060_BOUNDARY: Record<'Ranked' | 'Unranked', string> = {
  Ranked: '21 July 2026',
  Unranked: '14 September 2026',
};

//The cohort curve answers in bucket space: a 1000-wide bin reads 44.82 for 44,820 real units.
const WIDE = new Set(['souls', 'damage', 'damage_taken', 'player_healing', 'damage_mitigated']);
export const metricScale = (metric: string): number => (WIDE.has(metric) ? 1000 : 1);

export interface PlayerSeries {
  player: RosterSlot;
  //minute_bucket -> the player's average at that instant, real units.
  byBucket: Map<number, number>;
  //matches alive at the busiest instant — under five the line is an anecdote.
  peakMatches: number;
  //True when the request came back 400/empty: the metric is served but this player has no arrays.
  empty: boolean;
}

export interface BandPoint {
  bucket: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  mean: number | null;
  sample: number;
}

//One league's band for one metric; called for the reference league and, when set, the second one.
export function useLeagueBand(tier: number | null, metric: string): BandPoint[] {
  const band = useQuery({
    queryKey: queryKeys.laneEconomyCurve({ tier: tier ?? 0, metric }),
    queryFn: () => api.getLaneEconomyCurve({ tier: tier as number, metric }),
    enabled: tier != null,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  const scale = metricScale(metric);
  return (band.data?.points ?? []).map((pt) => ({
    bucket: pt.minute_bucket,
    p25: pt.p25 == null ? null : pt.p25 * scale,
    p50: pt.p50 == null ? null : pt.p50 * scale,
    p75: pt.p75 == null ? null : pt.p75 * scale,
    mean: pt.mean == null ? null : pt.mean * scale,
    sample: pt.sample_players,
  }));
}

export function usePlayerCurves(
  roster: readonly RosterSlot[],
  metric: string,
  matchMode: 'Unranked' | 'Ranked',
  windowKey: WindowKey,
  tier: number,
) {
  //A windowed request for one of the five would 400, so those always read all games.
  const win = WINDOWLESS_METRICS.has(metric) ? {} : windowParams(windowKey);

  const players = useQueries({
    queries: roster.map((p) => {
      const params = {
        metric,
        match_mode: matchMode,
        ...(p.scope.hero_id == null ? {} : { hero: p.scope.hero_id }),
        ...win,
      };
      return {
        queryKey: queryKeys.playerEconomyCurve(p.account_id, params),
        queryFn: () => api.getPlayerEconomyCurve(p.account_id, params),
        staleTime: 10 * 60 * 1000,
        retry: false,
        //A window switch holds the previous line until the new one lands, instead of blanking.
        placeholderData: keepPreviousData,
      };
    }),
  });

  const bandPoints = useLeagueBand(tier, metric);

  const series: PlayerSeries[] = roster.map((p, i) => {
    const q = players[i];
    const points = q?.data?.you ?? q?.data?.points ?? [];
    const byBucket = new Map<number, number>();
    let peak = 0;
    for (const pt of points) {
      //A zero everywhere is an unfolded array, not a measurement — keep it out of the line.
      byBucket.set(pt.minute_bucket, pt.value);
      peak = Math.max(peak, pt.matches);
    }
    const allZero = points.length > 0 && points.every((pt) => pt.value === 0);
    return {
      player: p,
      byBucket: allZero ? new Map() : byBucket,
      peakMatches: peak,
      empty: points.length === 0 || allZero,
    };
  });

  return {
    series,
    bandPoints,
    pending: players.some((q) => q.isPending),
    coverage: players[0]?.data?.coverage ?? null,
  };
}
