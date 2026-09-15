//The Lane Lab page: one roster, one metric, two leagues, and eight panels reading them.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { shortDate } from '../../../lib/format';
import { SCORECARD_BUCKETS, SCORECARD_METRICS } from '../../../lib/lanePercentile';
import CompareBar, { WINDOWS, type WindowKey } from './CompareBar';
import CurvePanel from './CurvePanel';
import GamesPanel from './GamesPanel';
import LadderPanel, { LEAGUE_NAMES, LEAGUE_TIERS } from './LadderPanel';
import Scorecard from './Scorecard';
import VsPanel from './VsPanel';
import SoulsSourcePanel from './SoulsSourcePanel';
import VerdictPanel from './VerdictPanel';
import { useRoster } from './useRoster';
import { FOLD_060_METRICS, WINDOWLESS_METRICS, useLeagueBand, usePlayerCurves } from './usePlayerCurves';
import { usePlayerModeGames } from './usePlayerModeGames';
import { useWindowPrefetch } from './useWindowPrefetch';
import { windowParams } from './CompareBar';

//Oracle: the largest league, and the fallback when nobody on the axis has a ranked game to read a
//display rank from (players.latest_rank is non-null for under 9% of known accounts).
const DEFAULT_TIER = 8;

export default function LaneLabPage() {
  const { roster, full, add, remove, scope } = useRoster();
  const [metric, setMetric] = useState('damage');
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [tierB, setTierB] = useState<number | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>('all');
  const [matchMode, setMatchMode] = useState<'Unranked' | 'Ranked'>('Unranked');
  const [bucket, setBucket] = useState<number>(SCORECARD_BUCKETS[0]);

  const horizon = useQueries({
    queries: [
      {
        queryKey: queryKeys.dataHorizon(),
        queryFn: () => api.getDataHorizon(),
        staleTime: 30 * 60 * 1000,
        retry: false,
      },
    ],
  })[0];
  const horizonLabel = shortDate(horizon?.data?.max_match_start_time) || 'the latest fold';

  //How many games each player has in the selected mode. Zero is the answer behind every empty
  //panel below, and each of them says so instead of "pending".
  const modeGames = usePlayerModeGames(roster, matchMode);
  const noGames = roster.filter((p) => modeGames.get(p.account_id) === 0);
  useWindowPrefetch(roster, matchMode, windowKey);

  const active = usePlayerCurves(roster, metric, matchMode, windowKey, tier);
  const bandPointsB = useLeagueBand(tierB, metric);
  //The verdict reads souls at 9:00 whatever the drawn metric is, so it needs its own souls pull.
  const souls = usePlayerCurves(roster, 'souls', matchMode, windowKey, tier);

  //The scorecard needs one value per (player, metric) at `bucket`. There is no bulk read, so this
  //is one curve request per pair — small, cached an hour server-side, and deduped by query key.
  const scorecardQueries = useQueries({
    queries: roster.flatMap((p) =>
      SCORECARD_METRICS.map((m) => {
        const params = {
          metric: m.key,
          match_mode: matchMode,
          ...(p.scope.hero_id == null ? {} : { hero: p.scope.hero_id }),
          ...(WINDOWLESS_METRICS.has(m.key) ? {} : windowParams(windowKey)),
        };
        return {
          queryKey: queryKeys.playerEconomyCurve(p.account_id, params),
          queryFn: () => api.getPlayerEconomyCurve(p.account_id, params),
          staleTime: 10 * 60 * 1000,
          retry: false,
          //The eleven cells hold their numbers through a window switch instead of going pending.
          placeholderData: keepPreviousData,
        };
      }),
    ),
  });

  //keepPreviousData holds `status` at success across a re-key, so the memo watches the update
  //stamp: without it the table would keep the previous window's numbers for good.
  const scorecardStamp = scorecardQueries.map((q) => `${q.status}:${q.dataUpdatedAt}`).join(',');
  const scorecardValues = useMemo(() => {
    const out = new Map<number, Map<string, number | null>>();
    roster.forEach((p, pi) => {
      const row = new Map<string, number | null>();
      SCORECARD_METRICS.forEach((m, mi) => {
        const q = scorecardQueries[pi * SCORECARD_METRICS.length + mi];
        const pts = q?.data?.you ?? q?.data?.points ?? [];
        //An all-zero series is an unfolded array, not a measured zero — show it as pending.
        const allZero = pts.length > 0 && pts.every((pt) => pt.value === 0);
        const hit = allZero ? undefined : pts.find((pt) => pt.minute_bucket === bucket);
        row.set(m.key, hit?.value ?? null);
      });
      out.set(p.account_id, row);
    });
    return out;
  }, [roster, bucket, scorecardStamp, matchMode, windowKey]);

  //A windowed read answers from the retained per-match timelines, and the working set does not keep
  //every game: a player whose last ten matches kept none gets an empty series, not a slow one.
  const windowCoverage = useMemo(() => {
    const out = new Map<number, { matches_with_timeline: number; matches_total: number } | null>();
    const mi = SCORECARD_METRICS.findIndex((m) => !FOLD_060_METRICS.has(m.key));
    roster.forEach((p, pi) => {
      const q = scorecardQueries[pi * SCORECARD_METRICS.length + Math.max(mi, 0)];
      out.set(p.account_id, q?.data?.coverage ?? null);
    });
    return out;
  }, [roster.map((p) => p.account_id).join(','), scorecardStamp, windowKey, matchMode]);
  const noTimeline =
    windowKey === 'all'
      ? []
      : roster.filter((p) => {
          const c = windowCoverage.get(p.account_id);
          return c != null && c.matches_with_timeline === 0 && c.matches_total > 0;
        });

  //Ladder marks are the active metric at the ladder's own instant, in real units.
  const ladderValues = useMemo(() => {
    const out = new Map<number, number | null>();
    for (const s of active.series) out.set(s.player.account_id, s.byBucket.get(bucket) ?? null);
    return out;
  }, [active.series, bucket]);

  //Per-league sample counts for the dropdown, read off whatever ladder curves have landed.
  const leagueCurves = useQueries({
    queries: LEAGUE_TIERS.map((t) => ({
      queryKey: queryKeys.laneEconomyCurve({ tier: t, metric }),
      queryFn: () => api.getLaneEconomyCurve({ tier: t, metric }),
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  });
  const leagueSamples = useMemo(() => {
    const out = new Map<number, number>();
    LEAGUE_TIERS.forEach((t, i) => {
      const pts = leagueCurves[i]?.data?.points ?? [];
      const peak = pts.reduce((a, p) => Math.max(a, p.sample_players), 0);
      if (peak > 0) out.set(t, peak);
    });
    return out;
  }, [leagueCurves.map((q) => q.status).join(','), metric]);

  const metricLabel = SCORECARD_METRICS.find((m) => m.key === metric)?.label ?? metric;
  const windowLabel = WINDOWS.find((w) => w.key === windowKey)?.label ?? 'All games';

  return (
    <>
      <CompareBar
        roster={roster}
        full={full}
        onAdd={(e) => add({ ...e, scope: { hero_id: null, hero_name: null } })}
        onRemove={remove}
        window={windowKey}
        onWindow={setWindowKey}
        matchMode={matchMode}
        onMatchMode={setMatchMode}
        tier={tier}
        onTier={(t) => {
          setTier(t);
          if (tierB === t) setTierB(null);
        }}
        tierB={tierB}
        onTierB={(t) => setTierB(t === tier ? null : t)}
        leagueSamples={leagueSamples}
        modeGames={modeGames}
        horizonLabel={horizonLabel}
      />

      <div className="ll-page">
        {roster.length === 0 && (
          <section className="ll-first">
            <h2 className="h-sec">Add a player to start.</h2>
            <p>
              Your own account, a friend, anyone. Up to four players share one axis, in the order you
              add them. The {LEAGUE_NAMES[tier]} band below is already measured, so a line just needs a
              player.
            </p>
          </section>
        )}

        {roster.length > 0 && (
          <VsPanel roster={roster} matchMode={matchMode} horizonLabel={horizonLabel} />
        )}

        {roster.length > 0 && (
          <>
            <div className="ll-at-tabs">
              <span className="ll-at-label">Read at</span>
              {SCORECARD_BUCKETS.map((b) => (
                <button
                  type="button"
                  key={b}
                  className={b === bucket ? 'on' : ''}
                  onClick={() => setBucket(b)}
                >
                  {b * 3}:00
                </button>
              ))}
            </div>
            <Scorecard
              roster={roster}
              bucket={bucket}
              tier={tier}
              tierName={LEAGUE_NAMES[tier] ?? `Tier ${tier}`}
              matchMode={matchMode}
              values={scorecardValues}
              modeGames={modeGames}
              noTimeline={noTimeline}
              windowLabel={windowLabel}
              metric={metric}
              onPickMetric={setMetric}
            />
          </>
        )}

        <CurvePanel
          series={active.series}
          bandPoints={active.bandPoints}
          bandPointsB={bandPointsB}
          metric={metric}
          onPickMetric={setMetric}
          tier={tier}
          tierB={tierB}
          matchMode={matchMode}
          windowLabel={windowLabel}
          coverage={active.coverage}
          noGames={noGames}
          noTimeline={noTimeline}
        />

        <LadderPanel
          roster={roster}
          metric={metric}
          metricLabel={metricLabel}
          bucket={bucket}
          tier={tier}
          tierB={tierB}
          onPickTier={(t) => {
            setTier(t);
            if (tierB === t) setTierB(null);
          }}
          playerValues={ladderValues}
          modeGames={modeGames}
          matchMode={matchMode}
        />

        {roster.length > 0 && (
          <SoulsSourcePanel
            roster={roster}
            matchMode={matchMode}
            buckets={SCORECARD_BUCKETS}
            modeGames={modeGames}
          />
        )}

        <VerdictPanel soulsSeries={souls.series} />

        {roster.length > 0 && (
          <GamesPanel roster={roster} matchMode={matchMode} onScope={scope} />
        )}

        <p className="ll-foot">
          Games through {horizonLabel}. The {LEAGUE_NAMES[tier]} reference is ranked games at that
          Valve display rank
          {tierB == null ? '' : `, and ${LEAGUE_NAMES[tierB]} is the second reference`}. Player lines
          are {matchMode} only.
        </p>
      </div>
    </>
  );
}
