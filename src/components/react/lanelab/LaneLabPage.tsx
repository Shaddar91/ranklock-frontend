//The Lane Lab page: one roster, one metric, two leagues, and eight panels reading them.
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { shortDate } from '../../../lib/format';
import { SCORECARD_BUCKETS, SCORECARD_METRICS } from '../../../lib/lanePercentile';
import CompareBar, { WINDOWS, type WindowKey } from './CompareBar';
import CurvePanel from './CurvePanel';
import GamesPanel from './GamesPanel';
import LadderPanel, { LEAGUE_NAMES } from './LadderPanel';
import Scorecard from './Scorecard';
import VsPanel from './VsPanel';
import SoulsSourcePanel from './SoulsSourcePanel';
import VerdictPanel from './VerdictPanel';
import { useRoster } from './useRoster';
import { useLeagueBand, usePlayerCurves } from './usePlayerCurves';
import { usePlayerModeGames } from './usePlayerModeGames';
import { useScorecard } from './useScorecard';
import { useWindowPrefetch } from './useWindowPrefetch';

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
  const scorecard = useScorecard(roster, metric, bucket, matchMode, windowKey, modeGames);

  //Ladder marks are the active metric at the ladder's own instant, in real units.
  const ladderValues = useMemo(() => {
    const out = new Map<number, number | null>();
    for (const s of active.series) out.set(s.player.account_id, s.byBucket.get(bucket) ?? null);
    return out;
  }, [active.series, bucket]);

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
        leagueSamples={scorecard.leagueSamples}
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
              values={scorecard.values}
              modeGames={modeGames}
              noTimeline={scorecard.noTimeline}
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
          noTimeline={scorecard.noTimeline}
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
            tier={tier}
            tierName={LEAGUE_NAMES[tier] ?? `Tier ${tier}`}
            buckets={SCORECARD_BUCKETS}
            modeGames={modeGames}
          />
        )}

        <VerdictPanel soulsSeries={souls.series} tier={tier} tierName={LEAGUE_NAMES[tier] ?? `Tier ${tier}`} />

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
