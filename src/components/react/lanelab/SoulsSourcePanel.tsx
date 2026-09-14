//"Where the souls come from" — the roster's souls split at 12:00 and 36:00 as one stacked bar per
//player, plus a per-source delta table against the reference. The reference is the LOBBY-average
//cohort: /lane-lab/souls-sources takes `band` only and ignores `tier=`, so this block cannot follow
//the league picked in the bar and says so in its caption.
import { useQueries, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count } from '../../../lib/format';
import {
  SOULS_GROUPS,
  SOULS_GROUP_LABEL,
  compositionAt,
  type SoulsGroup,
} from '../../../lib/soulsSources';
import { bucketClock } from '../../../lib/lanePercentile';
import type { RosterSlot } from '../../../lib/laneRoster';

//The brass ramp from lane creeps (the flattest source) out to objectives, then the two signed ones.
const GROUP_COLOR: Record<SoulsGroup, string> = {
  lane_creeps: 'var(--brass-4)',
  neutrals: 'var(--brass-3)',
  heroes: 'var(--brass-2)',
  objectives: 'var(--brass-1)',
  denies: 'var(--win)',
  losses: 'var(--loss)',
};

export interface SoulsSourcePanelProps {
  roster: readonly RosterSlot[];
  matchMode: 'Unranked' | 'Ranked';
  buckets: readonly number[];
}

export default function SoulsSourcePanel({
  roster,
  matchMode,
  buckets,
}: SoulsSourcePanelProps) {
  const players = useQueries({
    queries: roster.map((p) => ({
      queryKey: queryKeys.playerSoulsSources(p.account_id, {
        match_mode: matchMode,
        hero: p.scope.hero_id ?? undefined,
      }),
      queryFn: () =>
        api.getPlayerSoulsSources(p.account_id, {
          match_mode: matchMode,
          ...(p.scope.hero_id == null ? {} : { hero: p.scope.hero_id }),
        }),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const reference = useQuery({
    queryKey: queryKeys.laneSoulsSources({ match_mode: matchMode }),
    queryFn: () => api.getLaneSoulsSources({ match_mode: matchMode }),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  return (
    <section className="ll-souls brass-frame">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">Souls by source</div>
          <h2 className="h-sec">Where the souls come from</h2>
        </div>
        <ul className="ll-souls-legend">
          {SOULS_GROUPS.map((g) => (
            <li key={g}>
              <span className="ll-swatch" style={{ background: GROUP_COLOR[g] }} />
              {SOULS_GROUP_LABEL[g]}
            </li>
          ))}
        </ul>
      </header>

      {buckets.map((bucket) => {
        const ref = compositionAt(reference.data, bucket);
        const rows = roster.map((p, i) => ({
          player: p,
          comp: compositionAt(players[i]?.data, bucket),
        }));
        const max = Math.max(...rows.map((r) => r.comp.total), ref.total, 1);
        return (
          <div className="ll-souls-group" key={bucket}>
            <div className="ll-souls-at">
              <span>At {bucketClock(bucket)}</span>
              <small className="tnum">bar length = souls kept · axis to {count(max)}</small>
            </div>

            <div className="ll-souls-bars">
              {[...rows, { player: null, comp: ref }].map((row, ri) => {
                const label = row.player?.name ?? 'Lobby average';
                const ghost = row.player == null;
                return (
                  <div className="ll-souls-row" key={row.player?.account_id ?? `ref-${ri}`}>
                    <span className="ll-souls-who">
                      <span
                        className="ll-dot"
                        style={{
                          background: ghost ? 'transparent' : row.player?.color,
                          borderColor: ghost ? 'var(--text-2)' : row.player?.color,
                        }}
                      />
                      {label}
                    </span>
                    <div
                      className={`ll-souls-track${ghost ? ' ghost' : ''}`}
                      style={{ width: `${(row.comp.total / max) * 100}%` }}
                    >
                      {row.comp.segments.map((s) => (
                        <span
                          key={s.group}
                          className="ll-souls-seg"
                          style={{
                            flexBasis: `${s.share * 100}%`,
                            background: ghost
                              ? `color-mix(in oklab, ${GROUP_COLOR[s.group]} 35%, transparent)`
                              : GROUP_COLOR[s.group],
                          }}
                          title={`${SOULS_GROUP_LABEL[s.group]}: ${count(Math.round(s.souls))} souls · ${Math.round(s.share * 100)}% of ${label} at ${bucketClock(bucket)}`}
                        />
                      ))}
                    </div>
                    <span className="ll-souls-total tnum">{count(Math.round(row.comp.total))}</span>
                  </div>
                );
              })}
            </div>

            <table className="ll-souls-table">
              <thead>
                <tr>
                  <th>Source</th>
                  {roster.map((p) => (
                    <th key={p.account_id} style={{ color: p.color }}>
                      {p.name}
                    </th>
                  ))}
                  <th>Lobby avg</th>
                </tr>
              </thead>
              <tbody>
                {SOULS_GROUPS.map((g) => {
                  const refSouls = ref.segments.find((s) => s.group === g)?.souls ?? 0;
                  return (
                    <tr key={g}>
                      <th scope="row">
                        <span className="ll-swatch" style={{ background: GROUP_COLOR[g] }} />
                        {SOULS_GROUP_LABEL[g]}
                      </th>
                      {rows.slice(0, roster.length).map((r) => {
                        const v = r.comp.segments.find((s) => s.group === g)?.souls ?? 0;
                        const d = refSouls > 0 ? Math.round(((v - refSouls) / refSouls) * 100) : null;
                        //Taking fewer souls is worse everywhere except losses, where fewer is better.
                        const good = d == null ? false : g === 'losses' ? d < 0 : d > 0;
                        const tone = d == null || Math.abs(d) < 5 ? 'flat' : good ? 'good' : 'bad';
                        return (
                          <td className="tnum" key={r.player?.account_id ?? g}>
                            {count(Math.round(v))}
                            <small className={`tone-${tone}`}>
                              {d == null ? '' : `${d > 0 ? '+' : ''}${d}%`}
                            </small>
                          </td>
                        );
                      })}
                      <td className="tnum">{count(Math.round(refSouls))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <p className="ll-sc-foot">
        Lane creeps pay everyone on a timer, so the gap opens on neutrals, heroes and objectives. The
        reference is the lobby-average cohort across every rank — /lane-lab/souls-sources takes a
        lobby band only, so it does not follow the league picked above.
      </p>
    </section>
  );
}
