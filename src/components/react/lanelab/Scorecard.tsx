//"Where you stand" — the roster's value for each of the eleven metrics at one instant, with its
//percentile inside the chosen league underneath. Values come from each player's own curve; the
//percentiles from /lane-lab/percentiles, one call per metric carrying every player's value at once.
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, fixed } from '../../../lib/format';
import {
  SCORECARD_METRICS,
  bucketClock,
  percentileChip,
  weakestCells,
  type ScorecardMetric,
} from '../../../lib/lanePercentile';
import type { RosterSlot } from '../../../lib/laneRoster';
import { FOLD_060_METRICS } from './usePlayerCurves';

//A metric whose value is a soul/damage/heal total reads as 44,820; a count reads as 8.9.
const WIDE = new Set(['souls', 'damage', 'damage_taken', 'player_healing', 'damage_mitigated']);
const showValue = (metric: string, v: number): string =>
  metric === 'accuracy' ? `${fixed(v, 1)}%` : WIDE.has(metric) ? count(Math.round(v)) : fixed(v, 1);

export interface ScorecardProps {
  roster: readonly RosterSlot[];
  //The 180s bucket the card reads at — 4 is 12:00, 12 is 36:00.
  bucket: number;
  //Reference league, tier 1..11. The percentile is always "inside this league".
  tier: number;
  tierName: string;
  matchMode: 'Unranked' | 'Ranked';
  //Each player's value per metric at `bucket`, keyed account_id -> metric -> value. Null where the
  //player's curve has no such metric yet, which renders as a pending cell, never as a zero.
  values: Map<number, Map<string, number | null>>;
  //account_id -> games in `matchMode`; zero means the whole row is empty by right, not pending.
  modeGames: Map<number, number | null>;
  //Players whose games in the selected window kept no timeline, so a windowed cell cannot fill.
  noTimeline: readonly RosterSlot[];
  windowLabel: string;
  metric: string;
  onPickMetric: (metric: string) => void;
}

interface Cell {
  text: string;
  chip: string | null;
  tone: 'weak' | 'mid' | 'strong' | 'pending';
  standing: number | null;
  title: string;
}

//A roster slot the response could not be zipped back onto — never reached in practice, but the
//grid must still render a cell rather than a hole.
const MISSING: Cell = {
  text: '—',
  chip: null,
  tone: 'pending',
  standing: null,
  title: 'no value',
};

export default function Scorecard({
  roster,
  bucket,
  tier,
  tierName,
  matchMode,
  values,
  modeGames,
  noTimeline,
  windowLabel,
  metric,
  onPickMetric,
}: ScorecardProps) {
  const noTimelineIds = new Set(noTimeline.map((p) => p.account_id));
  //One percentiles request per metric: `values` is every player's number in axis order, so a
  //four-player row costs one call rather than four.
  const queries = useQueries({
    queries: SCORECARD_METRICS.map((m) => {
      const vals = roster.map((p) => values.get(p.account_id)?.get(m.key) ?? null);
      const present = vals.filter((v): v is number => v != null);
      return {
        queryKey: queryKeys.lanePercentiles({
          tier,
          minute: bucket,
          metric: m.key,
          values: present.join(','),
        }),
        queryFn: () =>
          api.getLanePercentiles({
            tier,
            minute: bucket,
            metric: m.key,
            values: present.join(','),
          }),
        enabled: present.length > 0,
        staleTime: 10 * 60 * 1000,
        retry: false,
      };
    }),
  });

  //Walk the response back onto the roster: the endpoint answers in the order the values were sent,
  //which skipped players whose metric is missing, so re-zip against that same filtered order.
  const cellsFor = (m: ScorecardMetric, qi: number): Cell[] => {
    const res = queries[qi]?.data?.results ?? [];
    let sent = 0;
    return roster.map((p) => {
      const v = values.get(p.account_id)?.get(m.key) ?? null;
      if (v == null) {
        const noGames = modeGames.get(p.account_id) === 0;
        //A windowed metric reads the retained timelines; the 060 five always read all games.
        const windowed = !FOLD_060_METRICS.has(m.key);
        const noWindow = windowed && noTimelineIds.has(p.account_id);
        return {
          text: '—',
          chip: noGames
            ? `no ${matchMode} games`
            : noWindow
              ? `no timeline in ${windowLabel.toLowerCase()}`
              : FOLD_060_METRICS.has(m.key)
                ? 'not in older games'
                : 'next update',
          tone: 'pending' as const,
          standing: null,
          title: noGames
            ? `${p.name} has no ${matchMode} games, so there is no ${m.label.toLowerCase()} to read`
            : noWindow
              ? `None of ${p.name}'s ${windowLabel.toLowerCase()} games kept a per-minute timeline, so this window has nothing to read. All games does.`
              : FOLD_060_METRICS.has(m.key)
                ? `${m.label} was not recorded for ${p.name}'s older games, so it stays blank for them`
                : `${m.label}: no ${m.label.toLowerCase()} in ${p.name}'s curve yet`,
        };
      }
      const share = res[sent++]?.below_share ?? null;
      if (share == null) {
        return {
          text: showValue(m.key, v),
          chip: null,
          tone: 'pending' as const,
          standing: null,
          title: `${p.name} ${m.label} at ${bucketClock(bucket)}: ${showValue(m.key, v)} · no ${tierName} sample at this minute`,
        };
      }
      const chip = percentileChip(share, m.inverted);
      return {
        text: showValue(m.key, v),
        chip: chip.label,
        tone: chip.tone,
        standing: chip.standing,
        title: `${p.name} ${m.label} at ${bucketClock(bucket)}: ${showValue(m.key, v)} · ${chip.label} of ${tierName} · n ${count(queries[qi]?.data?.sample_players ?? 0)}`,
      };
    });
  };

  //Walk each metric ONCE — cellsFor carries a per-call cursor into the response, so calling it per
  //(metric, player) would restart that cursor on every cell.
  const byMetric = SCORECARD_METRICS.map((m, mi) => ({ key: m.key, cells: cellsFor(m, mi) }));
  const rows = roster.map((p, ri) => ({
    player: p,
    cells: byMetric.map((col) => ({ key: col.key, cell: col.cells[ri] ?? MISSING })),
  }));
  //The two weakest cells per PLAYER row get marked — an eleven-wide row needs a pointer.
  const marks = rows.map((r) => weakestCells(r.cells.map((c) => c.cell.standing)));
  const sampleN = queries.find((q) => q.data?.sample_players)?.data?.sample_players ?? 0;

  return (
    <section className="ll-sc">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">Where you stand</div>
          <h2 className="h-sec">
            Among {tierName} players at {bucketClock(bucket)}
          </h2>
        </div>
        <p className="ll-sc-note">
          Value on top, percentile below · the two weakest cells per row are marked · click a column
          to draw it
        </p>
      </header>

      <div className="ll-sc-scroll">
        <div className="ll-sc-grid" style={{ '--ll-cols': SCORECARD_METRICS.length } as React.CSSProperties}>
          <div className="ll-sc-th">Player</div>
          {SCORECARD_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`ll-sc-th ll-sc-col${m.key === metric ? ' on' : ''}`}
              onClick={() => onPickMetric(m.key)}
              title={`Draw ${m.label} in the curve`}
            >
              {m.label}
            </button>
          ))}
          {rows.map((row, ri) => (
            <div className="ll-sc-row" key={row.player.account_id}>
              <div className="ll-sc-name">
                <span className="ll-dot" style={{ background: row.player.color }} />
                <span>{row.player.name}</span>
              </div>
              {row.cells.map(({ key, cell }, ci) => (
                <div
                  key={key}
                  className={`ll-sc-cell tone-${cell.tone}${marks[ri]?.[ci] ? ' weak-mark' : ''}`}
                  title={cell.title}
                >
                  <span className="ll-sc-v tnum">{cell.text}</span>
                  {cell.chip && <span className="ll-sc-chip">{cell.chip}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="ll-sc-foot">
        {tierName}: {count(sampleN)} player-games, ranked only · percentile = share of {tierName}{' '}
        player-games below the value; deaths invert · player lines are {matchMode} · a cell reading
        "not in older games" was never recorded for those games, so it will not fill
      </p>
    </section>
  );
}
