//"What your souls at 9:00 are worth in wins" — the all-ranks win rate per 1000-soul bucket of net
//worth at 9:00, with each player's measured 9:00 value placed on it. /lane-lab/early-econ-verdict
//takes a lobby `band` only and ignores tier=, so this ladder is every rank together and says so.
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, pct } from '../../../lib/format';
import type { PlayerSeries } from './usePlayerCurves';

//Below this a bucket is a handful of games, not a rate worth quoting.
const MIN_BUCKET_GAMES = 5000;
//9:00 is the third 180s instant.
const NINE_MIN_BUCKET = 3;

export interface VerdictPanelProps {
  //Each player's souls curve — the 9:00 value is read straight off it, never projected from a pace.
  soulsSeries: readonly PlayerSeries[];
}

export default function VerdictPanel({ soulsSeries }: VerdictPanelProps) {
  const verdict = useQuery({
    queryKey: queryKeys.laneEarlyEconVerdict({}),
    queryFn: () => api.getLaneEarlyEconVerdict({}),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const buckets = [...(verdict.data?.buckets ?? [])]
    .filter((b) => b.games >= MIN_BUCKET_GAMES)
    .sort((a, b) => a.souls_bucket_9min - b.souls_bucket_9min);

  if (buckets.length === 0) return null;

  const lo = buckets[0]?.souls_bucket_9min ?? 0;
  const hi = buckets.at(-1)?.souls_bucket_9min ?? 0;
  const totalGames = buckets.reduce((a, b) => a + b.games, 0);

  const marks = soulsSeries
    .map((s) => ({ s, v: s.byBucket.get(NINE_MIN_BUCKET) ?? null }))
    .filter((m): m is { s: PlayerSeries; v: number } => m.v != null);

  return (
    <section className="ll-verdict">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">The 9-minute verdict</div>
          <h2 className="h-sec">What your souls at 9:00 are worth in wins</h2>
        </div>
        <p className="ll-sc-note">
          Win rate by net worth at 9:00 · all ranks together · {count(totalGames)} player-games
        </p>
      </header>

      <div className="ll-verdict-scroll">
        <div className="ll-verdict-marks">
          {marks.map((m, i) => {
            const clamped = Math.min(Math.max(m.v / 1000, lo), hi);
            const left = ((clamped - lo) / Math.max(hi - lo, 1)) * 100;
            return (
              <span
                key={m.s.player.account_id}
                style={{ left: `${left}%`, top: `${(i % 2) * 15}px`, color: m.s.player.color }}
              >
                {m.s.player.name} {(m.v / 1000).toFixed(1)}K
              </span>
            );
          })}
        </div>
        <div
          className="ll-verdict-cells"
          style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
        >
          {buckets.map((b) => {
            //50% is the neutral middle; the tint walks out from it in both directions.
            const wr = (b.win_rate ?? 0) * 100;
            const away = Math.min(Math.abs(wr - 50) / 25, 1);
            const hue = wr < 50 ? 'var(--loss)' : 'var(--win)';
            return (
              <div
                key={b.souls_bucket_9min}
                title={`${count(b.games)} games from ${count(b.souls_floor)} souls at 9:00 · ${count(b.wins)} won`}
                style={{
                  background: `color-mix(in oklab, ${hue} ${Math.round(away * 28)}%, var(--raised))`,
                  borderColor: `color-mix(in oklab, ${hue} ${Math.round(away * 55)}%, var(--border))`,
                }}
              >
                <strong className="tnum">{pct(wr, 0)}</strong>
                <small className="tnum">
                  {b.souls_floor >= 1000 ? `${b.souls_floor / 1000}K` : `${b.souls_floor}`}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="ll-verdict-lines">
        {marks.map((m) => {
          const first = buckets[0];
          if (!first) return null;
          const cell = buckets.reduce((best, b) => (b.souls_floor <= m.v ? b : best), first);
          const two = buckets[Math.min(buckets.indexOf(cell) + 2, buckets.length - 1)];
          return (
            <li key={m.s.player.account_id}>
              <span className="ll-dot" style={{ background: m.s.player.color }} />
              {m.s.player.name} at {(m.v / 1000).toFixed(1)}K: games like this are won{' '}
              {pct((cell?.win_rate ?? 0) * 100, 0)} of the time
              {two && two !== cell
                ? `; ${two.souls_floor / 1000}K would be ${pct((two.win_rate ?? 0) * 100, 0)}.`
                : '.'}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
