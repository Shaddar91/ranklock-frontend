//"Which league do you play like" — one metric's median at a fixed minute across all eleven
//leagues, with each roster player marked on it. There is no ladder endpoint: this is eleven
///lane-lab/economy-curve?tier= reads, each answering one league's whole curve, sampled at `bucket`.
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, fixed } from '../../../lib/format';
import { RANK_MIN_SAMPLE } from '../../../lib/laneCurve';
import { bucketClock } from '../../../lib/lanePercentile';
import type { RosterSlot } from '../../../lib/laneRoster';

//tier 1..11, Initiate to Eternus — the display-rank tiers, NOT the 0..11 lobby band.
export const LEAGUE_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const LEAGUE_NAMES: Record<number, string> = {
  1: 'Initiate',
  2: 'Seeker',
  3: 'Acolyte',
  4: 'Sentinel',
  5: 'Mystic',
  6: 'Ritualist',
  7: 'Emissary',
  8: 'Oracle',
  9: 'Phantom',
  10: 'Ascendant',
  11: 'Eternus',
};

//The cohort curve answers in bucket space: a 1000-wide bin reads 44.82 for 44,820 real units.
const WIDE = new Set(['souls', 'damage', 'damage_taken', 'player_healing', 'damage_mitigated']);
const toReal = (metric: string, v: number): number => (WIDE.has(metric) ? v * 1000 : v);
const show = (metric: string, v: number): string =>
  WIDE.has(metric) ? `${fixed(v / 1000, 1)}K` : fixed(v, 1);

export interface LadderPanelProps {
  roster: readonly RosterSlot[];
  metric: string;
  metricLabel: string;
  bucket: number;
  tier: number;
  //The optional second reference league, outlined rather than filled. Set in the compare bar.
  tierB: number | null;
  onPickTier: (tier: number) => void;
  //Each player's own value for `metric` at `bucket`, in real units.
  playerValues: Map<number, number | null>;
  //account_id -> games in the selected match mode; 0 means every panel below is empty by right.
  modeGames: Map<number, number | null>;
  matchMode: 'Unranked' | 'Ranked';
}

export default function LadderPanel({
  roster,
  metric,
  metricLabel,
  bucket,
  tier,
  tierB,
  onPickTier,
  playerValues,
  modeGames,
  matchMode,
}: LadderPanelProps) {
  const queries = useQueries({
    queries: LEAGUE_TIERS.map((t) => ({
      queryKey: queryKeys.laneEconomyCurve({ tier: t, metric }),
      queryFn: () => api.getLaneEconomyCurve({ tier: t, metric }),
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  });

  const bars = LEAGUE_TIERS.map((t, i) => {
    const point = queries[i]?.data?.points.find((p) => p.minute_bucket === bucket);
    const p50 = point?.p50 ?? null;
    return {
      tier: t,
      name: LEAGUE_NAMES[t] ?? `Tier ${t}`,
      value: p50 == null ? null : toReal(metric, p50),
      sample: point?.sample_players ?? 0,
      //Under the floor the bar draws hollow: the median is real but the sample is too thin to lean on.
      thin: (point?.sample_players ?? 0) < RANK_MIN_SAMPLE,
    };
  });

  const known = bars.map((b) => b.value).filter((v): v is number => v != null);
  const playerNums = roster
    .map((p) => playerValues.get(p.account_id) ?? null)
    .filter((v): v is number => v != null);
  const max = Math.max(...known, ...playerNums, 1) * 1.08;

  if (known.length === 0) {
    return (
      <section className="ll-ladder">
        <header className="ll-sc-head">
          <div>
            <div className="kicker">League ladder</div>
            <h2 className="h-sec">
              Which league do you play like · {metricLabel} at {bucketClock(bucket)}
            </h2>
          </div>
        </header>
        <p className="ll-empty">
          The {metricLabel.toLowerCase()} ladder arrives with the next data update.
        </p>
      </section>
    );
  }

  return (
    <section className="ll-ladder">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">League ladder</div>
          <h2 className="h-sec">
            Which league do you play like · {metricLabel} at {bucketClock(bucket)}
          </h2>
        </div>
        <p className="ll-sc-note">
          Bar = league median · hollow bar = under the {count(RANK_MIN_SAMPLE)} player-game floor ·
          click a bar to set the reference
          {tierB == null ? '' : ` · outlined = ${LEAGUE_NAMES[tierB]}, the second reference`}
        </p>
      </header>

      <div className="ll-ladder-body">
        <div className="ll-ladder-plot">
          <div className="ll-ladder-bars">
            {bars.map((b) => (
              <button
                type="button"
                key={b.tier}
                className={`ll-ladder-bar${b.tier === tier ? ' on' : ''}${b.tier === tierB ? ' on-b' : ''}${b.thin ? ' thin' : ''}`}
                onClick={() => onPickTier(b.tier)}
                title={`${b.name} median ${b.value == null ? 'no sample' : show(metric, b.value)} at ${bucketClock(bucket)} · ${count(b.sample)} player-games`}
              >
                <span className="ll-ladder-bar-v tnum">
                  {b.value == null ? '' : show(metric, b.value)}
                </span>
                <span
                  className="ll-ladder-bar-fill"
                  style={{ height: `${b.value == null ? 0 : (b.value / max) * 100}%` }}
                />
              </button>
            ))}
          </div>
          {roster.map((p) => {
            const v = playerValues.get(p.account_id) ?? null;
            if (v == null) return null;
            return (
              <div
                className="ll-ladder-mark"
                key={p.account_id}
                style={{ top: `${(1 - v / max) * 100}%`, borderColor: p.color }}
              />
            );
          })}
        </div>
        <ul className="ll-ladder-legend">
          {roster.map((p) => {
            const v = playerValues.get(p.account_id) ?? null;
            const noGames = modeGames.get(p.account_id) === 0;
            //Which league's median the player's own number sits at or above.
            const sits = v == null ? null : bars.filter((b) => b.value != null && b.value <= v).pop();
            return (
              <li key={p.account_id}>
                <span className="ll-rule" style={{ background: p.color }} />
                <span style={{ color: p.color }}>{p.name}</span>
                <span className="tnum">
                  {noGames ? '—' : v == null ? 'pending' : show(metric, v)}
                </span>
                <small>
                  {noGames
                    ? `no ${matchMode} games`
                    : v == null
                      ? 'no value at this minute'
                      : sits == null
                        ? 'below every league'
                        : sits.tier === 11
                          ? 'plays like Eternus'
                          : `sits at ${sits.name}`}
                </small>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
