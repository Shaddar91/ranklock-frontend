//"You vs them" — per-game averages for the whole roster side by side, each tile carrying its
//difference against the first player on the axis. Reads /players/{id}/economy, one call per player;
//the deltas are computed here so a four-player axis does not need three pairwise compare calls.
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, fixed } from '../../../lib/format';
import { scopeLabel, type RosterSlot } from '../../../lib/laneRoster';
import type { PlayerEconomy } from '../../../types/api';

type Fmt = 'int' | 'dec' | 'pct';

interface TileSpec {
  label: string;
  //Pulled off /players/{id}/economy. Null means the field is not served yet (accuracy).
  read: (e: PlayerEconomy, matches: number) => number | null;
  fmt: Fmt;
  //Deaths: a smaller number is the better one, so the delta's colour flips.
  inverted?: boolean;
  //Games is a size, not a performance — it never gets a delta.
  plain?: boolean;
}

const TILES: readonly TileSpec[] = [
  { label: 'Souls / min', read: (e) => e.souls_per_min ?? null, fmt: 'int' },
  { label: 'Last hits / min', read: (e) => e.last_hits_per_min ?? null, fmt: 'dec' },
  { label: 'Denies', read: (e) => e.avg_denies ?? null, fmt: 'dec' },
  { label: 'Kills', read: (e) => e.avg_kills ?? null, fmt: 'dec' },
  { label: 'Deaths', read: (e) => e.avg_deaths ?? null, fmt: 'dec', inverted: true },
  { label: 'Assists', read: (e) => e.avg_assists ?? null, fmt: 'dec' },
  { label: 'Damage / min', read: (e) => e.damage_per_min ?? null, fmt: 'int' },
  //Accuracy needs pooled shots on the percentile accumulator; the endpoint does not serve it yet.
  { label: 'Accuracy', read: () => null, fmt: 'pct' },
  { label: 'Games', read: (_e, matches) => matches, fmt: 'int', plain: true },
];

const show = (v: number, fmt: Fmt): string =>
  fmt === 'pct' ? `${fixed(v, 1)}%` : fmt === 'int' ? count(Math.round(v)) : fixed(v, 2);

export interface VsPanelProps {
  roster: readonly RosterSlot[];
  matchMode: 'Unranked' | 'Ranked';
  windowLabel: string;
  horizonLabel: string;
}

export default function VsPanel({ roster, matchMode, windowLabel, horizonLabel }: VsPanelProps) {
  const queries = useQueries({
    queries: roster.map((p) => ({
      queryKey: queryKeys.playerEconomy(p.account_id, 'Normal'),
      queryFn: () => api.getPlayerEconomy(p.account_id, 'Normal'),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const first = queries[0]?.data ?? null;
  const firstName = roster[0]?.name ?? '';

  return (
    <section className="ll-vs">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">You vs them</div>
          <h2 className="h-sec">Per game, side by side</h2>
        </div>
        <p className="ll-sc-note">
          Per-game averages · {matchMode} · {windowLabel} · through {horizonLabel} · deltas against{' '}
          {firstName}
        </p>
      </header>

      <div className="ll-vs-rows">
        {roster.map((p, i) => {
          const econ = queries[i]?.data ?? null;
          const matches = econ?.matches ?? 0;
          return (
            <div className="ll-vs-row" key={p.account_id}>
              <div className="ll-vs-who">
                <span className="ll-dot" style={{ background: p.color }} />
                <div>
                  <div className="ll-vs-name">{p.name}</div>
                  <div className="ll-vs-sub tnum">
                    {count(matches)} games · {scopeLabel(p.scope)}
                  </div>
                </div>
              </div>
              <div className="ll-vs-tiles">
                {TILES.map((t) => {
                  const v = econ ? t.read(econ, matches) : null;
                  const base = first && !t.plain ? t.read(first, first.matches ?? 0) : null;
                  let delta = '';
                  let tone = 'flat';
                  if (i > 0 && v != null && base != null && base !== 0) {
                    const pct = ((v - base) / base) * 100;
                    const better = t.inverted ? pct < 0 : pct > 0;
                    tone = Math.abs(pct) < 2 ? 'flat' : better ? 'good' : 'bad';
                    const word = t.inverted
                      ? pct < 0
                        ? 'fewer'
                        : 'more'
                      : pct > 0
                        ? 'higher'
                        : 'lower';
                    delta = `${Math.abs(pct).toFixed(0)}% ${word}`;
                  } else if (i > 0 && v != null && base == null && !t.plain) {
                    delta = `no ${firstName} value yet`;
                  }
                  return (
                    <div
                      className={`ll-tile${v == null ? ' pending' : ''}`}
                      key={t.label}
                      title={`${p.name} ${t.label}: ${v == null ? 'not served yet' : show(v, t.fmt)} · ${count(matches)} games`}
                    >
                      <div className="ll-tile-k">{t.label}</div>
                      <div className="ll-tile-v tnum">{v == null ? 'pending' : show(v, t.fmt)}</div>
                      <div className={`ll-tile-d tone-${tone}`}>{delta}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
