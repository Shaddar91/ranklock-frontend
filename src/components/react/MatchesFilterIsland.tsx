//React island for /matches — client-side Normal/Brawl/All toggle over SSG-fetched rows.
import { useState } from 'react';
import { duration, shortDate } from '../../lib/format';
import { rankFromBadge, subLabel } from '../../lib/ranks';
import { filterMatchRows, gameModeLabel, isRanked, type MatchesModeSlug } from '../../lib/matchesMode';
import { filterRowsByRanked } from '../../lib/matchesRanked';
import { useMatchesRanked } from '../../lib/useMatchesRanked';
import type { Badge, MatchRow } from '../../types/api';

function badgeLabel(b: Badge): string {
  const rk = rankFromBadge(b);
  return rk ? subLabel(rk.tier, rk.sub) : '—';
}

function winnerLabel(team: number | null): string {
  return team === 0 ? 'Amber' : team === 1 ? 'Sapphire' : '—';
}

export default function MatchesFilterIsland({ matches }: { matches: MatchRow[] }) {
  const [slug, setSlug] = useState<MatchesModeSlug>('normal');
  const { ranked: rankedFilter, setRanked } = useMatchesRanked();
  const rows = filterRowsByRanked(filterMatchRows(matches, slug), rankedFilter);
  //average_badge_team0/1 is the rank block, which is not ingested (re-fold skip-list #5),
  //so it is 0/null (no rank) on every row — hide the two rank columns until real badges
  //land (rankFromBadge is the same real-rank test badgeLabel uses; they self-restore then).
  const hasTeamBadges = rows.some((m) => rankFromBadge(m.average_badge_team0) != null || rankFromBadge(m.average_badge_team1) != null);

  return (
    <div>
      <div className="flex" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="brkfilter gm-toggle" role="group" aria-label="Match mode">
          {(['normal', 'brawl', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={'minitog' + (slug === s ? ' on' : '')}
              aria-pressed={slug === s}
              onClick={() => setSlug(s)}
            >
              {s === 'normal' ? 'Normal' : s === 'brawl' ? 'Brawl' : 'All'}
            </button>
          ))}
        </div>
        <div className="brkfilter gm-toggle" role="group" aria-label="Ranked filter">
          {(['any', 'ranked', 'unranked'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={'minitog' + (rankedFilter === r ? ' on' : '')}
              aria-pressed={rankedFilter === r}
              onClick={() => setRanked(r)}
            >
              {r === 'any' ? 'Any' : r === 'ranked' ? 'Ranked' : 'Unranked'}
            </button>
          ))}
        </div>
      </div>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ padding: '24px' }}>No matches for this filter.</p>
        ) : (
          <div className="dt-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th><span className="th-static">Match</span></th>
                  <th><span className="th-static">Mode</span></th>
                  {hasTeamBadges && <th><span className="th-static">Amber rank</span></th>}
                  {hasTeamBadges && <th><span className="th-static">Sapphire rank</span></th>}
                  <th className="num"><span className="th-static">Duration</span></th>
                  <th><span className="th-static">Result</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const gLabel = gameModeLabel(m.game_mode);
                  const ranked = isRanked(m.match_mode);
                  const tooltip = [m.game_mode, m.match_mode].filter(Boolean).join(' · ') || undefined;
                  return (
                    <tr key={m.match_id}>
                      <td>
                        <a href={`/matches/${m.match_id}/`} className="display" style={{ fontWeight: 600 }}>
                          #{m.match_id}
                        </a>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{shortDate(m.start_time)}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {gLabel ? (
                            <>
                              <span className="chip" title={tooltip}>{gLabel}</span>
                              {ranked && <span className="chip" title={tooltip}>Ranked</span>}
                            </>
                          ) : (
                            <span className="muted">{m.game_mode ?? m.match_mode ?? '—'}</span>
                          )}
                        </div>
                      </td>
                      {hasTeamBadges && <td><span className="amber-c">{badgeLabel(m.average_badge_team0)}</span></td>}
                      {hasTeamBadges && <td><span className="sap-c">{badgeLabel(m.average_badge_team1)}</span></td>}
                      <td className="num"><span className="tnum">{duration(m.duration_s)}</span></td>
                      <td>
                        <span className={'chip' + (m.winning_team === 0 ? ' gold' : '')}>{winnerLabel(m.winning_team)} win</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
